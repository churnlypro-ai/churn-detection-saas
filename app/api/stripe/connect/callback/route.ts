import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { exchangeCodeForAccount, verifyConnectState } from '@/lib/stripeConnect';

function redirectToUpload(req: NextRequest, status: 'connected' | 'denied' | 'error') {
  const url = new URL('/upload', process.env.NEXT_PUBLIC_APP_URL || req.url);
  url.searchParams.set('stripe', status);
  return NextResponse.redirect(url);
}

// Stripe redirige ici le navigateur du client après l'écran d'autorisation
// OAuth — jamais de token d'auth Supabase disponible à ce stade, seul le
// paramètre `state` signé (voir lib/stripeConnect) permet de savoir quel
// compte Churnly vient d'autoriser l'accès.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Le client a cliqué "Annuler" sur l'écran Stripe.
  if (searchParams.get('error')) {
    return redirectToUpload(req, 'denied');
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code || !state) {
    return redirectToUpload(req, 'error');
  }

  const userId = verifyConnectState(state);
  if (!userId) {
    console.error('[stripe/connect/callback] invalid or expired state');
    return redirectToUpload(req, 'error');
  }

  try {
    const accountId = await exchangeCodeForAccount(code);
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from('users')
      .update({ stripe_connect_account_id: accountId })
      .eq('id', userId);

    if (error) {
      console.error('[stripe/connect/callback] failed to save account id', JSON.stringify({ userId, error }));
      return redirectToUpload(req, 'error');
    }

    return redirectToUpload(req, 'connected');
  } catch (err) {
    console.error('[stripe/connect/callback] token exchange failed', err);
    return redirectToUpload(req, 'error');
  }
}
