import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireOwnerId } from '@/lib/team';
import { buildGmailAuthUrl, customerRedirectUri } from '@/lib/googleGmail';

const STATE_COOKIE = 'customer_gmail_oauth_state';

// Connecter Gmail engage l'envoi réel de rétention depuis cette adresse —
// réservé au propriétaire du compte, jamais un membre d'équipe (même
// principe que Stripe Connect, les clés API et les webhooks, voir
// requireOwnerId).
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const accountId = await requireOwnerId(supabaseAdmin, token);
  if (!accountId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Le compte à reconnecter au retour de Google n'est pas déductible d'un
  // en-tête Authorization (Google redirige en navigation directe) — il est
  // donc encodé dans le cookie state lui-même et re-vérifié à l'identique
  // dans /callback, jamais fait confiance depuis un paramètre d'URL.
  const nonce = crypto.randomBytes(24).toString('hex');
  const state = `${nonce}.${accountId}`;
  const response = NextResponse.json({ url: buildGmailAuthUrl(state, customerRedirectUri()) });
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
