import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateClientEmail, type AnalysisLanguage } from '@/lib/claude';
import { runChurnAnalysis } from '@/lib/analysis';

function parseLanguage(value: unknown): AnalysisLanguage {
  return value === 'en' ? 'en' : 'fr';
}

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

  const body = await req.json();
  const { action } = body ?? {};

  if (action === 'generate_email') {
    const { templateId, client, language } = body;
    if (!templateId || !client) {
      return NextResponse.json({ error: 'Missing templateId or client data' }, { status: 400 });
    }
    try {
      const email = await generateClientEmail(templateId, {
        ...client,
        risk_factors: client.details?.risk_factors,
        recommended_actions: client.details?.recommended_actions,
      }, parseLanguage(language));
      return NextResponse.json({ subject: email.subject, body: email.body });
    } catch (err) {
      console.error('[analyze] email generation failed', err);
      return NextResponse.json({ error: 'Email generation failed' }, { status: 500 });
    }
  }

  const { clients, filename, language } = body ?? {};
  if (!Array.isArray(clients) || clients.length === 0) {
    return NextResponse.json({ error: 'No client data provided' }, { status: 400 });
  }
  // Sans plafond, un seul appel authentifié pourrait déclencher un nombre
  // arbitraire d'appels à l'API Claude (coût direct, sans rapport avec la
  // taille réelle d'une base clients).
  if (clients.length > 2000) {
    return NextResponse.json({ error: 'Trop de clients en une seule fois (max 2000).' }, { status: 400 });
  }

  try {
    const result = await runChurnAnalysis(supabaseAdmin, userId, clients, filename ?? null, parseLanguage(language));
    return NextResponse.json(result);
  } catch (err) {
    console.error('[analyze] failed', err);
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
