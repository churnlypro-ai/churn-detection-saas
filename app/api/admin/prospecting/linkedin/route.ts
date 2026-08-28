import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return null;
  return { supabaseAdmin, userId: userData!.user!.id };
}

// Ancré sur le protocole + le nom d'hôte, pas juste "contient la
// sous-chaîne" — voir lib/linkedinProspectingDraft.ts pour le détail du
// raisonnement (sinon "notlinkedin.com/in/x" passerait la vérification).
const LINKEDIN_URL_PATTERN = /^https?:\/\/([a-z0-9-]+\.)?linkedin\.com\/(in|company)\//i;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await auth.supabaseAdmin
    .from('linkedin_prospecting')
    .select('id, contact_name, linkedin_url, message, status, created_at, sent_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: 'Chargement échoué.' }, { status: 500 });
  return NextResponse.json({ contacts: data });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

  const { error } = await auth.supabaseAdmin.from('linkedin_prospecting').insert({
    contact_name: contactName.trim(),
    linkedin_url: linkedinUrl.trim(),
    message: message.trim(),
    created_by: auth.userId,
  });

  if (error) return NextResponse.json({ error: 'Ajout échoué.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
