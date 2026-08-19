import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateClientEmail, type AnalysisLanguage } from '@/lib/claude';
import { runChurnAnalysis } from '@/lib/analysis';
import { resolveAccountId } from '@/lib/team';

function parseLanguage(value: unknown): AnalysisLanguage {
  return value === 'en' ? 'en' : 'fr';
}

// Un gros upload (jusqu'à 2000 lignes, voir plus bas) peut prendre plus que
// les 15s par défaut d'une fonction Vercel une fois les batchs Claude
// traités avec une concurrence bornée (voir MAX_CONCURRENT_BATCHES dans
// lib/claude.ts). Le plafond réel dépend quand même du plan Vercel (Hobby
// reste limité à 60s quoi qu'il arrive).
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
  const userId = userData.user.id;

  const body = await req.json();
  const { action } = body ?? {};

  if (action === 'generate_email') {
    const { templateId, client, language } = body;
    if (!templateId || !client) {
      return NextResponse.json({ error: 'Missing templateId or client data' }, { status: 400 });
    }
    try {
      const email = await generateClientEmail(templateId, {
        ...client,
        risk_factors: client.details?.risk_factors,
        recommended_actions: client.details?.recommended_actions,
      }, parseLanguage(language));
      return NextResponse.json({ subject: email.subject, body: email.body });
    } catch (err) {
      console.error('[analyze] email generation failed', err);
      return NextResponse.json({ error: 'Email generation failed' }, { status: 500 });
    }
  }

  const { clients, filename, language } = body ?? {};
  if (!Array.isArray(clients) || clients.length === 0) {
    return NextResponse.json({ error: 'No client data provided' }, { status: 400 });
  }
  // Sans plafond, un seul appel authentifié pourrait déclencher un nombre
  // arbitraire d'appels à l'API Claude (coût direct, sans rapport avec la
  // taille réelle d'une base clients).
  if (clients.length > 2000) {
    return NextResponse.json({ error: 'Trop de clients en une seule fois (max 2000).' }, { status: 400 });
  }

  try {
    // Un membre d'équipe qui importe un CSV analyse les clients du compte
    // auquel il appartient, pas un compte vide à son propre nom.
    const accountId = await resolveAccountId(supabaseAdmin, userId);

    // Chaque analyse coûte un vrai appel Claude — sans ce garde-fou, un
    // compte non abonné pouvait continuer à en déclencher indéfiniment, le
    // résultat restant juste caché derrière le teaser côté dashboard. Le
    // blocage doit être ici, pas seulement à l'affichage. Un compte gratuit
    // a droit à une seule analyse (trial_used posé à true par
    // runChurnAnalysis une fois celle-ci aboutie, voir lib/analysis.ts) —
    // au-delà, seul un abonnement débloque de nouvelles analyses.
    const { data: accountProfile } = await supabaseAdmin
      .from('users')
      .select('subscription_status, trial_used')
      .eq('id', accountId)
      .maybeSingle();
    const hasAccess = accountProfile?.subscription_status === 'active'
      || accountProfile?.subscription_status === 'trialing'
      || !accountProfile?.trial_used;
    if (!hasAccess) {
      return NextResponse.json({ error: 'subscription_required' }, { status: 402 });
    }

    const result = await runChurnAnalysis(supabaseAdmin, accountId, clients, filename ?? null, parseLanguage(language));
    return NextResponse.json(result);
  } catch (err) {
    console.error('[analyze] failed', err);
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
