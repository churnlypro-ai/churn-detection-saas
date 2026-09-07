import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchClientsFromLemonSqueezyAccount } from '@/lib/lemonSqueezyConnect';
import { decryptSecret } from '@/lib/tokenCrypto';
import { runChurnAnalysis } from '@/lib/analysis';
import type { AnalysisLanguage } from '@/lib/claude';
import { resolveAccountId } from '@/lib/team';

function parseLanguage(value: unknown): AnalysisLanguage {
  return value === 'en' ? 'en' : 'fr';
}

// Voir la même note dans app/api/stripe/connect/import/route.ts.
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
  const userId = await resolveAccountId(supabaseAdmin, userData.user.id);

  const body = await req.json().catch(() => ({}));
  const { language } = body ?? {};

  const [{ data: connection }, { data: profile }] = await Promise.all([
    supabaseAdmin.from('lemonsqueezy_connection').select('api_key_encrypted').eq('account_id', userId).maybeSingle(),
    supabaseAdmin.from('users').select('subscription_status, trial_used').eq('id', userId).maybeSingle(),
  ]);

  if (!connection?.api_key_encrypted) {
    return NextResponse.json({ error: 'Aucun compte Lemon Squeezy connecté.' }, { status: 400 });
  }

  const hasAccess = profile?.subscription_status === 'active'
    || profile?.subscription_status === 'trialing'
    || !profile?.trial_used;
  if (!hasAccess) {
    return NextResponse.json({ error: 'subscription_required' }, { status: 402 });
  }

  try {
    const apiKey = decryptSecret(connection.api_key_encrypted);
    const clients = await fetchClientsFromLemonSqueezyAccount(apiKey);
    if (clients.length === 0) {
      return NextResponse.json(
        { error: 'Aucun client avec un abonnement en cours trouvé sur ce compte Lemon Squeezy.' },
        { status: 400 },
      );
    }

    const result = await runChurnAnalysis(supabaseAdmin, userId, clients, 'Lemon Squeezy', parseLanguage(language));
    return NextResponse.json(result);
  } catch (err) {
    console.error('[lemonsqueezy/connect/import] failed', JSON.stringify({ userId, err: err instanceof Error ? err.message : err }));
    return NextResponse.json({ error: 'Import depuis Lemon Squeezy échoué. Réessayez.' }, { status: 500 });
  }
}
