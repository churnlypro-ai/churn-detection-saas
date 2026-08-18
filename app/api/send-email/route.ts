import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resolveAccountId } from '@/lib/team';
import { runWeeklyReports } from '@/lib/weeklyReports';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token && token !== process.env.CRON_SECRET) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    // Un membre d'équipe qui envoie un email agit sur les clients du compte
    // auquel il appartient, pas sur un compte vide à son propre nom — voir
    // lib/team.ts.
    const userId = await resolveAccountId(supabaseAdmin, userData.user.id);

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

  return handleCron();
}

export async function GET(req: NextRequest) {
  const providedSecret =
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    req.headers.get('x-cron-secret') ??
    new URL(req.url).searchParams.get('secret');

  if (!process.env.CRON_SECRET || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return handleCron();
}

async function handleCron() {
  const supabaseAdmin = getSupabaseAdmin();
  const results = await runWeeklyReports(supabaseAdmin);
  return NextResponse.json({ results });
}
