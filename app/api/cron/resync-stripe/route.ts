import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchClientsFromConnectedAccount } from '@/lib/stripeConnect';
import { runChurnAnalysis } from '@/lib/analysis';
import { runWeeklyReports } from '@/lib/weeklyReports';

// Un compte qui connecte Stripe n'obtenait une analyse qu'une seule fois, au
// moment de la connexion — rien ne la remettait à jour ensuite, ni cron ni
// webhook. Résultat : le churn_score affiché vieillissait dès que le client
// ne recliquait pas manuellement "importer", alors que le produit se vend
// justement sur "on sait qui va partir maintenant". Ce cron ferme cette
// boucle : il tourne tous les jours (voir vercel.json) mais ne relance
// l'analyse que pour les comptes dont analysis_frequency le justifie ce
// jour-là (voir shouldRunToday) — "manual" n'est jamais touché ici.
export const maxDuration = 300;

interface StripeConnectedUser {
  id: string;
  stripe_connect_account_id: string;
  language: string | null;
  analysis_frequency: string;
}

// 'daily' tourne tous les jours (comportement historique, toujours le
// défaut) ; 'weekly'/'monthly' réutilisent les mêmes ancres que les bilans
// hebdo et l'ancien système de parrainage (lundi / 1er du mois) plutôt que
// d'ajouter un 3e cron — le plan Vercel Hobby n'en autorise que 2 ; 'manual'
// ne tourne jamais ici, le client relance lui-même depuis /upload.
function shouldRunToday(frequency: string, now: Date): boolean {
  if (frequency === 'weekly') return now.getUTCDay() === 1;
  if (frequency === 'monthly') return now.getUTCDate() === 1;
  if (frequency === 'manual') return false;
  return true;
}

async function handleCron(req: NextRequest) {
  const providedSecret =
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    req.headers.get('x-cron-secret') ??
    new URL(req.url).searchParams.get('secret');

  if (!process.env.CRON_SECRET || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, stripe_connect_account_id, language, analysis_frequency')
    .not('stripe_connect_account_id', 'is', null)
    .in('subscription_status', ['active', 'trialing']);

  if (usersError) {
    console.error('[cron/resync-stripe] failed to load users', usersError);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }

  const results: { userId: string; clientCount: number; error?: string }[] = [];
  const now = new Date();

  // Séquentiel plutôt qu'en parallèle : chaque analyse utilisateur lance
  // déjà plusieurs batchs Claude en parallèle en interne (voir
  // MAX_CONCURRENT_BATCHES dans lib/claude.ts) — cumuler ça sur tous les
  // comptes en même temps ferait exactement le problème de rate limit que
  // cette borne existe pour éviter.
  for (const user of (users ?? []) as StripeConnectedUser[]) {
    if (!shouldRunToday(user.analysis_frequency, now)) continue;
    try {
      const clients = await fetchClientsFromConnectedAccount(user.stripe_connect_account_id);
      if (clients.length === 0) {
        results.push({ userId: user.id, clientCount: 0 });
        continue;
      }
      const language = user.language === 'en' ? 'en' : 'fr';
      await runChurnAnalysis(supabaseAdmin, user.id, clients, 'Stripe (auto)', language);
      results.push({ userId: user.id, clientCount: clients.length });
    } catch (err) {
      console.error(`[cron/resync-stripe] failed for user ${user.id}`, err instanceof Error ? err.message : err);
      results.push({ userId: user.id, clientCount: 0, error: err instanceof Error ? err.message : 'unknown error' });
    }
  }

  // Le plan Vercel Hobby limite à 2 cron jobs — pas de créneau dédié pour le
  // bilan hebdomadaire. Ce cron tourne déjà tous les jours ; il déclenche en
  // plus l'envoi des bilans chaque lundi (juste après le resync, données
  // fraîches), sans rien faire les autres jours.
  let weeklyReports: Awaited<ReturnType<typeof runWeeklyReports>> = [];
  if (new Date().getUTCDay() === 1) {
    try {
      weeklyReports = await runWeeklyReports(supabaseAdmin);
    } catch (err) {
      console.error('[cron/resync-stripe] weekly reports failed', err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ results, weeklyReports });
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
