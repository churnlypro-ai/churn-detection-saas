import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { relanguageDraftsBatch, type ProspectLanguage, type DraftToFix } from '@/lib/prospectingDraft';

// Corrige des brouillons déjà en file rédigés dans la mauvaise langue —
// voir la note dans lib/prospectingDraft.ts. Potentiellement plusieurs
// appels Claude chunkés, même raison de dépassement des 15s par défaut
// que les autres routes qui enchaînent des appels IA.
export const maxDuration = 300;

const VALID_LANGUAGES: ProspectLanguage[] = ['fr', 'en', 'es', 'de', 'pt'];

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return null;
  return { supabaseAdmin, userId: userData!.user!.id };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string') : [];
  const language: ProspectLanguage | null = VALID_LANGUAGES.includes(body?.language) ? body.language : null;

  if (ids.length === 0) return NextResponse.json({ error: 'Aucun email sélectionné.' }, { status: 400 });
  if (!language) return NextResponse.json({ error: 'Langue invalide.' }, { status: 400 });

  // Seuls les brouillons encore en attente sont corrigeables — pas
  // question de modifier l'historique d'un email déjà envoyé.
  const { data: rows, error: fetchError } = await auth.supabaseAdmin
    .from('prospecting_emails')
    .select('id, company_name, subject, body')
    .in('id', ids)
    .eq('status', 'queued');

  if (fetchError) return NextResponse.json({ error: 'Lecture échouée.' }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json({ fixed: 0, message: 'Aucun brouillon en attente parmi la sélection.' });

  const toFix: DraftToFix[] = rows.map((r) => ({
    id: r.id,
    company: r.company_name ?? '',
    subject: r.subject,
    body: r.body,
  }));

  const fixed = await relanguageDraftsBatch(toFix, language);

  let updated = 0;
  for (const f of fixed) {
    const { error: updateError } = await auth.supabaseAdmin
      .from('prospecting_emails')
      .update({ subject: f.subject, body: f.body })
      .eq('id', f.id);
    if (!updateError) updated += 1;
  }

  return NextResponse.json({ fixed: updated });
}
