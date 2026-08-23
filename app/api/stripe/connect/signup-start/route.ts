import { NextRequest, NextResponse } from 'next/server';
import { getConnectAuthUrl, signSignupState } from '@/lib/stripeConnect';

// Contrairement à /api/stripe/connect/start, cette route n'exige aucune
// session Churnly : elle sert à créer le compte, pas à en lier un qui existe
// déjà (voir signup-callback pour la création réelle du compte).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const language = body?.language === 'en' ? 'en' : 'fr';
  const utm = {
    utmSource: typeof body?.utmSource === 'string' ? body.utmSource : null,
    utmMedium: typeof body?.utmMedium === 'string' ? body.utmMedium : null,
    utmCampaign: typeof body?.utmCampaign === 'string' ? body.utmCampaign : null,
  };

  try {
    const state = signSignupState(language, utm);
    return NextResponse.json({ url: getConnectAuthUrl(state, '/api/stripe/connect/signup-callback') });
  } catch (err) {
    console.error('[stripe/connect/signup-start] failed', err);
    return NextResponse.json({ error: 'Could not start Stripe signup.' }, { status: 500 });
  }
}
