import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resolveAccountId } from '@/lib/team';

// Modifier un brouillon avant l'envoi groupé — même principe que l'édition
// de la file de prospection admin : seulement tant qu'il n'a pas déjà été
// envoyé.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
  const accountId = await resolveAccountId(supabaseAdmin, userData.user.id);

  const body = await req.json().catch(() => ({}));
  const { subject, body: emailBody, clientEmail } = body ?? {};

  if (typeof subject !== 'string' || !subject.trim()) {
    return NextResponse.json({ error: 'Objet requis.' }, { status: 400 });
  }
  if (typeof emailBody !== 'string' || !emailBody.trim()) {
    return NextResponse.json({ error: 'Corps du mail requis.' }, { status: 400 });
  }
  if (clientEmail !== undefined && clientEmail !== null && typeof clientEmail === 'string' && clientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    return NextResponse.json({ error: 'Email destinataire invalide.' }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    subject: subject.trim(),
    body: emailBody,
    updated_at: new Date().toISOString(),
  };
  if (clientEmail !== undefined) {
    update.client_email = typeof clientEmail === 'string' && clientEmail.trim() ? clientEmail.trim() : null;
  }

  const { data, error } = await supabaseAdmin
    .from('client_retention_drafts')
    .update(update)
    .eq('id', params.id)
    .eq('account_id', accountId)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Modification échouée.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Brouillon introuvable ou déjà envoyé.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
