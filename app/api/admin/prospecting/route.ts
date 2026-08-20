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

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await auth.supabaseAdmin
    .from('prospecting_emails')
    .select('id, company_name, recipient_email, subject, body, status, error_message, created_at, sent_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: 'Chargement échoué.' }, { status: 500 });
  return NextResponse.json({ emails: data });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

  const { error } = await auth.supabaseAdmin.from('prospecting_emails').insert({
    company_name: typeof companyName === 'string' ? companyName.trim() || null : null,
    recipient_email: recipientEmail.trim(),
    subject: subject.trim(),
    body: emailBody,
    created_by: auth.userId,
  });

  if (error) return NextResponse.json({ error: 'Ajout échoué.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
