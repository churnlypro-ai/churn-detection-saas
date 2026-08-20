import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { refreshAccessToken, sendGmailMessage } from '@/lib/googleGmail';
import { decryptSecret } from '@/lib/tokenCrypto';
import { logAuditEvent } from '@/lib/auditLog';

// Envoyer 15 emails un par un avec des pauses peut dépasser largement les
// 15s par défaut d'une fonction Vercel — même limite déjà rencontrée sur
// /api/analyze et /api/stripe/connect/import pour la même raison.
export const maxDuration = 300;

// Volontairement bas : le but est de coller au rythme "étalé dans la
// journée" qu'on fait déjà à la main, pas de maximiser le débit. Voir
// playbook — au-delà, un envoi qui ressemble à de l'automatisation abîme
// la délivrabilité de churnly.pro@gmail.com.
const MAX_BATCH_SIZE = 15;
const MIN_DELAY_MS = 10_000;
const MAX_DELAY_MS = 18_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitterDelay(): number {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const requestedCount = Number(body?.count) || 5;
  const count = Math.min(Math.max(1, requestedCount), MAX_BATCH_SIZE);

  const { data: connection } = await supabaseAdmin
    .from('admin_gmail_connection')
    .select('connected_email, refresh_token_encrypted')
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ error: 'Gmail non connecté. Connecte-le depuis cette page avant d\'envoyer.' }, { status: 400 });
  }

  const { data: queued, error: queueError } = await supabaseAdmin
    .from('prospecting_emails')
    .select('id, recipient_email, subject, body')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(count);

  if (queueError) return NextResponse.json({ error: 'Lecture de la file échouée.' }, { status: 500 });
  if (!queued || queued.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, message: 'File vide.' });
  }

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(decryptSecret(connection.refresh_token_encrypted));
  } catch (err) {
    console.error('[prospecting/send] token refresh failed', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Connexion Gmail expirée — reconnecte-la depuis cette page.' }, { status: 400 });
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < queued.length; i += 1) {
    const item = queued[i];
    try {
      await sendGmailMessage({
        accessToken,
        fromEmail: connection.connected_email,
        to: item.recipient_email,
        subject: item.subject,
        body: item.body,
      });
      await supabaseAdmin
        .from('prospecting_emails')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
        .eq('id', item.id);
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      console.error('[prospecting/send] send failed', JSON.stringify({ id: item.id, message }));
      await supabaseAdmin
        .from('prospecting_emails')
        .update({ status: 'failed', error_message: message.slice(0, 500) })
        .eq('id', item.id);
      failed += 1;
    }

    if (i < queued.length - 1) {
      await sleep(jitterDelay());
    }
  }

  await logAuditEvent(supabaseAdmin, userData!.user!.id, 'prospecting_batch_sent', { sent, failed, requested: count });

  return NextResponse.json({ sent, failed });
}
