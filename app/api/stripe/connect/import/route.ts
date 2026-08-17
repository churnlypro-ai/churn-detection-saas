import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchClientsFromConnectedAccount } from '@/lib/stripeConnect';
import { runChurnAnalysis } from '@/lib/analysis';
import type { AnalysisLanguage } from '@/lib/claude';

function parseLanguage(value: unknown): AnalysisLanguage {
  return value === 'en' ? 'en' : 'fr';
}

// Voir la même note dans app/api/analyze/route.ts — un compte Stripe avec
// beaucoup de clients (jusqu'à 2000, voir MAX_CUSTOMERS dans
// lib/stripeConnect.ts) peut dépasser le timeout par défaut d'une fonction
// Vercel une fois les batchs Claude traités avec une concurrence bornée.
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

  const body = await req.json().catch(() => ({}));
  const { language } = body ?? {};

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('stripe_connect_account_id')
    .eq('id', userId)
    .maybeSingle();

  const accountId = profile?.stripe_connect_account_id;
  if (!accountId) {
    return NextResponse.json({ error: 'Aucun compte Stripe connecté.' }, { status: 400 });
  }

  try {
    const clients = await fetchClientsFromConnectedAccount(accountId);
    if (clients.length === 0) {
      return NextResponse.json(
        { error: 'Aucun client avec un abonnement en cours trouvé sur ce compte Stripe.' },
        { status: 400 },
      );
    }

    const result = await runChurnAnalysis(supabaseAdmin, userId, clients, 'Stripe', parseLanguage(language));
    return NextResponse.json(result);
  } catch (err) {
    console.error('[stripe/connect/import] failed', JSON.stringify({ userId, err: err instanceof Error ? err.message : err }));
    return NextResponse.json({ error: 'Import depuis Stripe échoué. Réessayez.' }, { status: 500 });
  }
}
