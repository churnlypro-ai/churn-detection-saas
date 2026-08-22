import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireOwnerId } from '@/lib/team';
import { refreshAccessToken, sendGmailMessage } from '@/lib/googleGmail';
import { decryptSecret } from '@/lib/tokenCrypto';

// Même limite et même espacement que l'envoi de prospection admin — même
// principe (compte email réel, pas d'automatisation qui ressemble à un
// bot), même si ici les destinataires ont déjà une relation avec le
// compte, donc un risque de réputation moindre.
export const maxDuration = 300;

const MAX_BATCH_SIZE = 15;
const MIN_DELAY_MS = 10_000;
const MAX_DELAY_MS = 18_000;

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function jitterDelay(): number { return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS); }

// Réservé au propriétaire : c'est sa propre boîte mail connectée qui envoie,
// un membre d'équipe ne doit jamais pouvoir déclencher un envoi depuis elle.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const accountId = await requireOwnerId(supabaseAdmin, token);
  if (!accountId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  // Deux modes, comme sur la file de prospection admin : une sélection
  // explicite d'ids (contrôle fin depuis l'UI), ou à défaut tous les
  // brouillons en attente avec un email. Dans les deux cas, plafonné à
  // MAX_BATCH_SIZE.
  const requestedIds = Array.isArray(body?.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === 'string').slice(0, MAX_BATCH_SIZE)
    : null;

  const { data: connection } = await supabaseAdmin
    .from('customer_email_connection')
    .select('connected_email, refresh_token_encrypted')
    .eq('account_id', accountId)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ error: 'Aucun email connecté. Connecte ton Gmail depuis le dashboard avant d\'envoyer.' }, { status: 400 });
  }

  if (requestedIds && requestedIds.length === 0) {
    return NextResponse.json({ error: 'Aucun email sélectionné.' }, { status: 400 });
  }

  let draftsQuery = supabaseAdmin
    .from('client_retention_drafts')
    .select('id, client_name, client_email, subject, body')
    .eq('account_id', accountId)
    .eq('status', 'draft')
    .not('client_email', 'is', null)
    .order('created_at', { ascending: true });

  draftsQuery = requestedIds ? draftsQuery.in('id', requestedIds) : draftsQuery.limit(MAX_BATCH_SIZE);

  const { data: drafts, error: draftsError } = await draftsQuery;

  if (draftsError) return NextResponse.json({ error: 'Lecture des brouillons échouée.' }, { status: 500 });
  if (!drafts || drafts.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, message: 'Aucun brouillon avec email à envoyer.' });
  }

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(decryptSecret(connection.refresh_token_encrypted));
  } catch (err) {
    console.error('[retention-drafts/send-batch] token refresh failed', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Connexion email expirée — reconnecte-la depuis le dashboard.' }, { status: 400 });
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < drafts.length; i += 1) {
    const draft = drafts[i];
    try {
      await sendGmailMessage({
        accessToken,
        fromEmail: connection.connected_email,
        to: draft.client_email as string,
        subject: draft.subject,
        body: draft.body,
      });
      await supabaseAdmin
        .from('client_retention_drafts')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
        .eq('id', draft.id);
      await supabaseAdmin.from('actions').insert({
        user_id: accountId,
        client_name: draft.client_name,
        action_type: 'email',
        completed: true,
      });
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      console.error('[retention-drafts/send-batch] send failed', JSON.stringify({ id: draft.id, message }));
      await supabaseAdmin
        .from('client_retention_drafts')
        .update({ status: 'failed', error_message: message.slice(0, 500) })
        .eq('id', draft.id);
      failed += 1;
    }

    if (i < drafts.length - 1) {
      await sleep(jitterDelay());
    }
  }

  return NextResponse.json({ sent, failed });
}
