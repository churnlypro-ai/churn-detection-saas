import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireOwnerId } from '@/lib/team';
import { runWeeklyReports } from '@/lib/weeklyReports';
import { refreshAccessToken, sendGmailMessage } from '@/lib/googleGmail';
import { decryptSecret } from '@/lib/tokenCrypto';

// Réservé au propriétaire : l'envoi se fait depuis SA boîte Gmail connectée
// (customer_email_connection), jamais depuis le domaine Churnly — un membre
// d'équipe ne doit jamais pouvoir déclencher un envoi depuis elle. Même
// règle que /api/retention-drafts/send-batch.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token && token !== process.env.CRON_SECRET) {
    const supabaseAdmin = getSupabaseAdmin();
    const accountId = await requireOwnerId(supabaseAdmin, token);
    if (!accountId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { subject, body: emailBody, clientName, clientEmail } = body ?? {};

    if (!subject || !emailBody) {
      return NextResponse.json({ error: 'Missing subject or body' }, { status: 400 });
    }
    if (typeof clientEmail !== 'string' || !clientEmail.trim()) {
      return NextResponse.json({ error: 'Ce client n\'a pas d\'email enregistré — ajoute une colonne email à ton CSV ou connecte Stripe.' }, { status: 400 });
    }

    const { data: connection } = await supabaseAdmin
      .from('customer_email_connection')
      .select('connected_email, refresh_token_encrypted')
      .eq('account_id', accountId)
      .maybeSingle();

    if (!connection) {
      return NextResponse.json({ error: 'Aucun email connecté. Connecte ton Gmail depuis le dashboard avant d\'envoyer.' }, { status: 400 });
    }

    let accessToken: string;
    try {
      accessToken = await refreshAccessToken(decryptSecret(connection.refresh_token_encrypted));
    } catch (err) {
      console.error('[send-email] token refresh failed', err instanceof Error ? err.message : err);
      return NextResponse.json({ error: 'Connexion email expirée — reconnecte-la depuis le dashboard.' }, { status: 400 });
    }

    try {
      await sendGmailMessage({
        accessToken,
        fromEmail: connection.connected_email,
        to: clientEmail.trim(),
        subject,
        body: emailBody,
      });
    } catch (err) {
      console.error('[send-email] send failed', err instanceof Error ? err.message : err);
      return NextResponse.json({ error: 'Envoi échoué — réessaie.' }, { status: 500 });
    }

    await supabaseAdmin.from('actions').insert({
      user_id: accountId,
      client_name: clientName ?? 'Unknown',
      action_type: 'email',
      completed: true,
    });

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
