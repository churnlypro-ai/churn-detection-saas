import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { analyzeChurnRisk, generateClientEmail } from '@/lib/claude';

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

    const rows = analysis.map((item) => ({
      user_id: userId,
      upload_id: upload.id,
      client_name: item.client_name,
      revenue_monthly: revenueByName.get(item.client_name) ?? 0,
      churn_score: item.churn_score,
      reason: item.summary_reason,
      solution: item.recommended_actions[0]?.detail ?? '',
      confidence: item.confidence,
      details: { risk_factors: item.risk_factors, recommended_actions: item.recommended_actions },
    }));

    const { error: insertError } = await supabaseAdmin.from('analysis_results').insert(rows);
    if (insertError) throw insertError;

    const atRiskCount = analysis.filter((item) => item.churn_score >= 60).length;

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
