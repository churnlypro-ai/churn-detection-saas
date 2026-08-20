import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { exchangeCodeForTokens } from '@/lib/googleGmail';
import { encryptSecret } from '@/lib/tokenCrypto';

const STATE_COOKIE = 'gmail_oauth_state';

function redirectTo(status: 'connected' | 'error'): NextResponse {
  const url = new URL('/admin/prospecting', process.env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set('gmail', status);
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

// Google redirige ici en navigation directe du navigateur (pas d'en-tête
// Authorization possible) — la protection vient du cookie state posé par
// /api/admin/gmail/connect, pas d'une vérification de session ici.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const expectedState = req.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    console.error('[gmail/callback] state mismatch or missing code');
    return redirectTo('error');
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Arrive si le compte avait déjà autorisé l'app sans prompt=consent
      // forcé quelque part — normalement couvert par buildGmailAuthUrl.
      console.error('[gmail/callback] no refresh_token returned');
      return redirectTo('error');
    }

    // Identifie le compte Google réellement connecté (churnly.pro@gmail.com
    // attendu) — affiché ensuite dans l'admin pour confirmer visuellement
    // qu'on n'a pas autorisé le mauvais compte.
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileRes.ok ? await profileRes.json() : null;
    const connectedEmail = profile?.email ?? 'inconnu';

    const supabaseAdmin = getSupabaseAdmin();
    // Une seule ligne à la fois : on remplace plutôt que d'accumuler des
    // connexions obsolètes.
    await supabaseAdmin.from('admin_gmail_connection').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error } = await supabaseAdmin.from('admin_gmail_connection').insert({
      connected_email: connectedEmail,
      refresh_token_encrypted: encryptSecret(tokens.refresh_token),
    });
    if (error) {
      console.error('[gmail/callback] insert failed', JSON.stringify(error));
      return redirectTo('error');
    }

    return redirectTo('connected');
  } catch (err) {
    console.error('[gmail/callback] failed', err instanceof Error ? err.message : err);
    return redirectTo('error');
  }
}
