import { NextRequest, NextResponse } from 'next/server';
import { getConnectAuthUrl, signAuditState } from '@/lib/stripeConnect';

// Aucune session Churnly requise, aucun compte créé — voir
// app/api/audit/callback pour le calcul et lib/stripeConnect.ts pour
// fetchFailedPaymentAudit. Sert la page publique app/audit.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const language = body?.language === 'en' ? 'en' : 'fr';
    const state = signAuditState();
    return NextResponse.json({ url: getConnectAuthUrl(state, `/api/audit/callback?lang=${language}`) });
  } catch (err) {
    console.error('[audit/start] failed', err);
    return NextResponse.json({ error: 'Could not start audit.' }, { status: 500 });
  }
}
