import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return null;
  return supabaseAdmin;
}

// Modifier un email de la file — seulement tant qu'il est encore en
// attente, pour ne jamais réécrire un email déjà envoyé (ou en cours).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAdmin = await requireAdmin(req);
  if (!supabaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { companyName, recipientEmail, subject, emailBody } = body ?? {};

  if (typeof recipientEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return NextResponse.json({ error: 'Email destinataire invalide.' }, { status: 400 });
  }
  if (typeof subject !== 'string' || !subject.trim()) {
    return NextResponse.json({ error: 'Objet requis.' }, { status: 400 });
  }
  if (typeof emailBody !== 'string' || !emailBody.trim()) {
    return NextResponse.json({ error: 'Corps du mail requis.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('prospecting_emails')
    .update({
      company_name: typeof companyName === 'string' ? companyName.trim() || null : null,
      recipient_email: recipientEmail.trim(),
      subject: subject.trim(),
      body: emailBody,
    })
    .eq('id', params.id)
    .eq('status', 'queued')
    .select('id');

  if (error) return NextResponse.json({ error: 'Modification échouée.' }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Cet email n\'est plus modifiable (déjà envoyé ou en cours d\'envoi).' }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Retirer un email déjà envoyé de la file ne le "désenvoie" pas — autorisé
  // seulement tant qu'il est encore en attente, pour éviter toute confusion.
  const { error } = await supabaseAdmin
    .from('prospecting_emails')
    .delete()
    .eq('id', params.id)
    .eq('status', 'queued');

  if (error) return NextResponse.json({ error: 'Suppression échouée.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
