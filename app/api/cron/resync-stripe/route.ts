import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchClientsFromConnectedAccount } from '@/lib/stripeConnect';
import { runChurnAnalysis } from '@/lib/analysis';

// Un compte qui connecte Stripe n'obtenait une analyse qu'une seule fois, au
// moment de la connexion — rien ne la remettait à jour ensuite, ni cron ni
// webhook. Résultat : le churn_score affiché vieillissait dès que le client
// ne recliquait pas manuellement "importer", alors que le produit se vend
// justement sur "on sait qui va partir maintenant". Ce cron ferme cette
// boucle : il relance l'analyse chaque jour pour tout compte Stripe
// connecté et payant/en essai (voir vercel.json pour la planification).
export const maxDuration = 300;

interface StripeConnectedUser {
  id: string;
  stripe_connect_account_id: string;
  language: string | null;
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
    .select('id, stripe_connect_account_id, language')
    .not('stripe_connect_account_id', 'is', null)
    .in('subscription_status', ['active', 'trialing']);

  if (usersError) {
    console.error('[cron/resync-stripe] failed to load users', usersError);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }

  const results: { userId: string; clientCount: number; error?: string }[] = [];

  // Séquentiel plutôt qu'en parallèle : chaque analyse utilisateur lance
  // déjà plusieurs batchs Claude en parallèle en interne (voir
  // MAX_CONCURRENT_BATCHES dans lib/claude.ts) — cumuler ça sur tous les
  // comptes en même temps ferait exactement le problème de rate limit que
  // cette borne existe pour éviter.
  for (const user of (users ?? []) as StripeConnectedUser[]) {
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

  return NextResponse.json({ results });
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
