import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getConnectAuthUrl, signConnectState } from '@/lib/stripeConnect';

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
    const state = signConnectState(userData.user.id);
    return NextResponse.json({ url: getConnectAuthUrl(state, '/api/stripe/connect/callback') });
  } catch (err) {
    console.error('[stripe/connect/start] failed', err);
    return NextResponse.json({ error: 'Could not start Stripe connection.' }, { status: 500 });
  }
}
