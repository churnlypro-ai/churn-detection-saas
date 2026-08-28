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

// Ancré sur le protocole + le nom d'hôte, pas juste "contient la
// sous-chaîne" — voir lib/linkedinProspectingDraft.ts pour le détail du
// raisonnement (sinon "notlinkedin.com/in/x" passerait la vérification).
const LINKEDIN_URL_PATTERN = /^https?:\/\/([a-z0-9-]+\.)?linkedin\.com\/(in|company)\//i;

// Modifier un contact de la file — seulement tant qu'il est encore en
// attente, pour ne jamais réécrire un contact déjà marqué envoyé.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAdmin = await requireAdmin(req);
  if (!supabaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { contactName, linkedinUrl, message } = body ?? {};

  if (typeof contactName !== 'string' || !contactName.trim()) {
    return NextResponse.json({ error: 'Nom requis.' }, { status: 400 });
  }
  if (typeof linkedinUrl !== 'string' || !LINKEDIN_URL_PATTERN.test(linkedinUrl.trim())) {
    return NextResponse.json({ error: 'Lien LinkedIn invalide (doit commencer par https://linkedin.com/in/... ou https://linkedin.com/company/...).' }, { status: 400 });
  }
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message requis.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('linkedin_prospecting')
    .update({
      contact_name: contactName.trim(),
      linkedin_url: linkedinUrl.trim(),
      message: message.trim(),
    })
    .eq('id', params.id)
    .eq('status', 'queued')
    .select('id');

  if (error) return NextResponse.json({ error: 'Modification échouée.' }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Ce contact n\'est plus modifiable (déjà marqué envoyé).' }, { status: 409 });
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

  // Retirer un contact déjà marqué envoyé de la file ne le "désenvoie" pas
  // — autorisé seulement tant qu'il est encore en attente, pour éviter
  // toute confusion.
  const { error } = await supabaseAdmin
    .from('linkedin_prospecting')
    .delete()
    .eq('id', params.id)
    .eq('status', 'queued');

  if (error) return NextResponse.json({ error: 'Suppression échouée.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
