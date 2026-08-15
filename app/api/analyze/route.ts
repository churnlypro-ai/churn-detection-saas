import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { analyzeChurnRisk, generateClientEmail } from '@/lib/claude';

function parseDateOrNull(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
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
    const { templateId, client } = body;
    if (!templateId || !client) {
      return NextResponse.json({ error: 'Missing templateId or client data' }, { status: 400 });
    }
    try {
      const email = await generateClientEmail(templateId, {
        ...client,
        risk_factors: client.details?.risk_factors,
        recommended_actions: client.details?.recommended_actions,
      });
      return NextResponse.json({ subject: email.subject, body: email.body });
    } catch (err) {
      console.error('[analyze] email generation failed', err);
      return NextResponse.json({ error: 'Email generation failed' }, { status: 500 });
    }
  }

  const { clients, filename } = body ?? {};
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
    const analysis = await analyzeChurnRisk(clients);

    const { data: upload, error: uploadError } = await supabaseAdmin
      .from('csv_uploads')
      .insert({ user_id: userId, client_count: clients.length, filename: filename ?? null })
      .select()
      .single();

    if (uploadError) throw uploadError;

    const revenueByName = new Map(
      clients.map((c: { name: string; revenue_monthly?: number }) => [
        c.name,
        Number(c.revenue_monthly) || 0,
      ]),
    );
    const renewalByName = new Map(
      clients.map((c: { name: string; renewal_date?: string }) => [c.name, parseDateOrNull(c.renewal_date)]),
    );

    const rows = analysis.map((item) => ({
      user_id: userId,
      upload_id: upload.id,
      client_name: item.client_name,
      revenue_monthly: revenueByName.get(item.client_name) ?? 0,
      renewal_date: renewalByName.get(item.client_name) ?? null,
      churn_score: item.churn_score,
      reason: item.summary_reason,
      solution: item.recommended_actions[0]?.detail ?? '',
      confidence: item.confidence,
      details: { risk_factors: item.risk_factors, recommended_actions: item.recommended_actions },
    }));

    const { error: insertError } = await supabaseAdmin.from('analysis_results').insert(rows);
    if (insertError) throw insertError;

    const atRiskCount = analysis.filter((item) => item.churn_score >= 60).length;

    // On ne demande jamais le taux de churn à l'inscription — une entreprise
    // qui vient chez Churnly ne le connaît généralement pas elle-même,
    // c'est exactement ce que l'analyse résout. C'est donc ici, à partir du
    // vrai résultat, que le chiffre est calculé et enregistré sur le compte.
    const computedChurnRate = clients.length > 0 ? (atRiskCount / clients.length) * 100 : 0;
    const { error: churnUpdateError } = await supabaseAdmin
      .from('users')
      .update({ churn_rate: Number(computedChurnRate.toFixed(1)) })
      .eq('id', userId);
    if (churnUpdateError) {
      console.error('[analyze] churn_rate update failed', JSON.stringify({ userId, churnUpdateError }));
    }

    return NextResponse.json({
      uploadId: upload.id,
      clientCount: clients.length,
      atRiskCount,
      analysis,
    });
  } catch (err) {
    console.error('[analyze] failed', err);
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
