import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendWeeklyReportEmail, sendWelcomeEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token && token !== process.env.CRON_SECRET) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { subject, body: emailBody, clientName } = body ?? {};

    if (!subject || !emailBody) {
      return NextResponse.json({ error: 'Missing subject or body' }, { status: 400 });
    }

    await supabaseAdmin.from('actions').insert({
      user_id: userId,
      client_name: clientName ?? 'Unknown',
      action_type: 'email',
      completed: true,
    });

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.email) {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Churnly <notifications@yourdomain.com>',
        to: profile.email,
        subject,
        html: emailBody.replace(/\n/g, '<br>'),
      });
    }

    return NextResponse.json({ sent: true });
  }

  const providedSecret =
    authHeader?.replace('Bearer ', '') ??
    req.headers.get('x-cron-secret') ??
    new URL(req.url).searchParams.get('secret');

  if (!process.env.CRON_SECRET || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return handleCron(req);
}

export async function GET(req: NextRequest) {
  const providedSecret =
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    req.headers.get('x-cron-secret') ??
    new URL(req.url).searchParams.get('secret');

  if (!process.env.CRON_SECRET || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, email, company_name, subscription_status, subscription_tier, created_at')
    .eq('subscription_status', 'active');

  if (usersError) {
    console.error('[send-email] failed to load users', usersError);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const results: { userId: string; sent: boolean; type: string }[] = [];

  for (const user of (users ?? []) as { id: string; email: string; company_name: string; subscription_tier: string | null; created_at: string }[]) {
    try {
      const { data: recentAnalysis } = await supabaseAdmin
        .from('analysis_results')
        .select('churn_score, revenue_monthly')
        .eq('user_id', user.id)
        .gte('analyzed_at', oneWeekAgo);

      const { data: completedActions } = await supabaseAdmin
        .from('actions')
        .select('id')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('created_at', oneWeekAgo);

      const rows = (recentAnalysis ?? []) as { churn_score: number; revenue_monthly: number }[];
      const atRisk = rows.filter((r) => r.churn_score >= 60);
      const churnRateNow = rows.length ? (atRisk.length / rows.length) * 100 : 0;
      const clientsSaved = completedActions?.length ?? 0;
      const revenueSaved = atRisk.reduce((sum, r) => sum + (Number(r.revenue_monthly) || 0), 0);
      const roiPercent = rows.length ? Math.round((clientsSaved / rows.length) * 100) : 0;

      await sendWeeklyReportEmail({
        to: user.email,
        companyName: user.company_name || 'là',
        clientsSaved,
        revenueSaved,
        roiPercent,
        churnRateNow: Number(churnRateNow.toFixed(1)),
        churnRateBefore: Number(churnRateNow.toFixed(1)),
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      });
      results.push({ userId: user.id, sent: true, type: 'weekly' });

      if (user.created_at && user.created_at <= fourteenDaysAgo) {
        const monthlyPrice = Number(user.subscription_tier) || 300;
        await sendWelcomeEmail({
          to: user.email,
          companyName: user.company_name || '',
          monthlyPrice,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
        });
        results.push({ userId: user.id, sent: true, type: 'welcome' });
      }
    } catch (err) {
      console.error(`[send-email] failed for user ${user.id}`, err);
      results.push({ userId: user.id, sent: false, type: 'error' });
    }
  }

  return NextResponse.json({ results });
}
