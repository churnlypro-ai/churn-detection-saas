import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { logAuditEvent } from '@/lib/auditLog';
import { isMissingTableError, missingTableMessage } from '@/lib/supabaseErrors';

const MIGRATION_FILE = '20260828000000_add_linkedin_prospecting.sql';

// Contrairement à Gmail, il n'existe pas d'API publique pour envoyer un
// message LinkedIn à la place de l'admin — automatiser ce geste exposerait
// le compte LinkedIn réel à un bannissement. Cette route ne fait donc
// qu'enregistrer que l'envoi a eu lieu, une fois que le front a ouvert le
// profil et copié le message dans le presse-papiers pour un envoi manuel.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('linkedin_prospecting')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('status', 'queued')
    .select('id');

  if (error) {
    console.error('[prospecting/linkedin/id/send] update failed', error);
    return NextResponse.json(
      { error: isMissingTableError(error) ? missingTableMessage(MIGRATION_FILE) : 'Marquage échoué.' },
      { status: 500 },
    );
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Contact introuvable ou déjà marqué envoyé.' }, { status: 409 });
  }

  await logAuditEvent(supabaseAdmin, userData!.user!.id, 'linkedin_prospect_marked_sent', { id: params.id });
  return NextResponse.json({ success: true });
}
