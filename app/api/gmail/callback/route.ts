import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { exchangeCodeForTokens, customerRedirectUri } from '@/lib/googleGmail';
import { encryptSecret } from '@/lib/tokenCrypto';

const STATE_COOKIE = 'customer_gmail_oauth_state';

function redirectTo(status: 'connected' | 'error', reason?: string): NextResponse {
  const url = new URL('/dashboard', process.env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set('gmail', status);
  if (reason) url.searchParams.set('reason', reason.slice(0, 300));
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

// Google redirige ici en navigation directe (pas d'en-tête Authorization
// possible) — le compte concerné est extrait du cookie state posé par
// /api/gmail/connect, jamais d'un paramètre d'URL non vérifié.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const expectedState = req.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    console.error('[gmail/callback] state mismatch or missing code');
    return redirectTo('error', 'Le lien de retour Google est invalide ou a expiré. Réessaie depuis le bouton Connecter.');
  }

  const accountId = expectedState.split('.')[1];
  if (!accountId) {
    return redirectTo('error', 'Compte introuvable dans le cookie de connexion.');
  }

  try {
    const tokens = await exchangeCodeForTokens(code, customerRedirectUri());
    if (!tokens.refresh_token) {
      console.error('[gmail/callback] no refresh_token returned');
      return redirectTo('error', 'Google n\'a renvoyé aucun refresh_token.');
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileRes.ok ? await profileRes.json() : null;
    const connectedEmail = profile?.email ?? 'inconnu';

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.from('customer_email_connection').upsert(
      {
        account_id: accountId,
        connected_email: connectedEmail,
        refresh_token_encrypted: encryptSecret(tokens.refresh_token),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id' },
    );
    if (error) {
      console.error('[gmail/callback] insert failed', JSON.stringify(error));
      return redirectTo('error', `Échec en base: ${error.message}`);
    }

    return redirectTo('connected');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[gmail/callback] failed', message);
    return redirectTo('error', message);
  }
}
