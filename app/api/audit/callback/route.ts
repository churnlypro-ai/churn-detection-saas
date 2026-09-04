import { NextRequest, NextResponse } from 'next/server';
import {
  disconnectAccount,
  exchangeCodeForAccount,
  fetchFailedPaymentAudit,
  verifyAuditState,
} from '@/lib/stripeConnect';

function redirectToAudit(req: NextRequest, status: 'denied' | 'error', language: 'fr' | 'en') {
  const url = new URL('/audit', process.env.NEXT_PUBLIC_APP_URL || req.url);
  url.searchParams.set('result', status);
  url.searchParams.set('lang', language);
  return NextResponse.redirect(url);
}

// Retour de l'autorisation OAuth déclenchée depuis /audit — voir
// /api/audit/start. Calcule le résultat puis déconnecte immédiatement le
// compte Stripe (stripe.oauth.deauthorize, voir disconnectAccount) : cet
// outil ne garde jamais d'accès à un compte Stripe qui n'est pas devenu
// client, contrairement au parcours d'inscription normal.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const language = searchParams.get('lang') === 'en' ? 'en' : 'fr';

  if (searchParams.get('error')) {
    return redirectToAudit(req, 'denied', language);
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code || !state || !verifyAuditState(state)) {
    console.error('[audit/callback] missing or invalid state');
    return redirectToAudit(req, 'error', language);
  }

  let accountId: string | null = null;
  try {
    accountId = await exchangeCodeForAccount(code);
    const audit = await fetchFailedPaymentAudit(accountId);

    const url = new URL('/audit/result', process.env.NEXT_PUBLIC_APP_URL || req.url);
    url.searchParams.set('lang', language);
    url.searchParams.set('currency', audit.currency);
    url.searchParams.set('lookbackDays', String(audit.lookbackDays));
    url.searchParams.set('failedCount', String(audit.failedCount));
    url.searchParams.set('failedAmount', String(audit.failedAmount));
    url.searchParams.set('unrecoverableCount', String(audit.unrecoverableCount));
    url.searchParams.set('unrecoverableAmount', String(audit.unrecoverableAmount));

    return NextResponse.redirect(url);
  } catch (err) {
    console.error('[audit/callback] failed', err instanceof Error ? err.message : err);
    return redirectToAudit(req, 'error', language);
  } finally {
    if (accountId) {
      try {
        await disconnectAccount(accountId);
      } catch (err) {
        console.error('[audit/callback] deauthorize failed', JSON.stringify({ accountId, err: err instanceof Error ? err.message : err }));
      }
    }
  }
}
