import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { disconnectAccount } from '@/lib/stripeConnect';
import { logAuditEvent } from '@/lib/auditLog';

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

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('stripe_connect_account_id')
    .eq('id', userId)
    .maybeSingle();

  const accountId = profile?.stripe_connect_account_id;

  if (accountId) {
    try {
      await disconnectAccount(accountId);
    } catch (err) {
      // Best-effort côté Stripe : même si la révocation échoue là-bas (compte
      // déjà déconnecté manuellement, par exemple), on retire quand même la
      // référence chez nous plutôt que de bloquer l'utilisateur.
      console.error('[stripe/connect/disconnect] stripe deauthorize failed', JSON.stringify({ userId, err: err instanceof Error ? err.message : err }));
    }
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ stripe_connect_account_id: null })
    .eq('id', userId);

  if (error) {
    console.error('[stripe/connect/disconnect] failed to clear account id', JSON.stringify({ userId, error }));
    return NextResponse.json({ error: 'Could not disconnect Stripe.' }, { status: 500 });
  }

  await logAuditEvent(supabaseAdmin, userId, 'stripe_disconnected');
  return NextResponse.json({ disconnected: true });
}
