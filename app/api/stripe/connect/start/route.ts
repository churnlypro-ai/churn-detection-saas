import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getConnectAuthUrl, signConnectState } from '@/lib/stripeConnect';
import { resolveAccountId } from '@/lib/team';

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

  try {
    // Un membre d'équipe qui connecte Stripe le fait pour le compte auquel
    // il appartient — le state signé encode donc directement l'id du
    // propriétaire, /api/stripe/connect/callback n'a rien d'autre à changer.
    const accountId = await resolveAccountId(supabaseAdmin, userData.user.id);
    const state = signConnectState(accountId);
    return NextResponse.json({ url: getConnectAuthUrl(state, '/api/stripe/connect/callback') });
  } catch (err) {
    console.error('[stripe/connect/start] failed', err);
    return NextResponse.json({ error: 'Could not start Stripe connection.' }, { status: 500 });
  }
}
