import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { buildGmailAuthUrl } from '@/lib/googleGmail';

const STATE_COOKIE = 'gmail_oauth_state';

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // state en cookie httpOnly, vérifié au retour dans /callback — protège
  // contre un lien d'autorisation forgé qui ferait accepter le consentement
  // Google d'un autre compte que celui prévu (voir la vérification côté
  // callback).
  const state = crypto.randomBytes(24).toString('hex');
  const response = NextResponse.json({ url: buildGmailAuthUrl(state) });
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
