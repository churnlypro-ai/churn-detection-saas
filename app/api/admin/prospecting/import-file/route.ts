import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { extractLeadsFromRawText, draftProspectEmailsBatch, type ExtractedLead } from '@/lib/prospectingDraft';

// Extraction + rédaction par fichier, potentiellement plusieurs fichiers et
// plusieurs lots de rédaction par lead (voir lib/prospectingDraft.ts) — même
// raison que les autres routes qui enchaînent des appels Claude : largement
// au-delà des 15s par défaut d'une fonction Vercel.
export const maxDuration = 300;

const EXTRACT_CONCURRENCY = 3;

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return null;
  return { supabaseAdmin, userId: userData!.user!.id };
}

interface IncomingFile {
  filename: string;
  contentBase64: string;
}

function fileToRawText(file: IncomingFile): string | null {
  if (!file.contentBase64) return null;
  const buffer = Buffer.from(file.contentBase64, 'base64');

  if (/\.(xlsx|xls)$/i.test(file.filename)) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetTexts = workbook.SheetNames.map((name) => XLSX.utils.sheet_to_csv(workbook.Sheets[name]));
      return sheetTexts.join('\n\n');
    } catch {
      return null;
    }
  }

  return buffer.toString('utf-8');
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const files: IncomingFile[] = Array.isArray(body?.files) ? body.files : [];
  if (files.length === 0) {
    return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 });
  }

  const rawTexts = files
    .map((f) => fileToRawText(f))
    .filter((t): t is string => !!t && t.trim().length > 0);

  if (rawTexts.length === 0) {
    return NextResponse.json({ error: 'Aucun contenu exploitable dans les fichiers envoyés.' }, { status: 400 });
  }

  // Extraction bornée en parallèle — un appel Claude par fichier/feuille.
  const allLeads: ExtractedLead[] = [];
  for (let i = 0; i < rawTexts.length; i += EXTRACT_CONCURRENCY) {
    const chunk = rawTexts.slice(i, i + EXTRACT_CONCURRENCY);
    const results = await Promise.all(chunk.map((t) => extractLeadsFromRawText(t).catch(() => [] as ExtractedLead[])));
    for (const r of results) allLeads.push(...r);
  }

  // Dédoublonnage au sein de ce lot (une même entreprise peut apparaître
  // dans plusieurs fichiers/feuilles collés dans le même import).
  const seen = new Set<string>();
  const deduped = allLeads.filter((lead) => {
    if (seen.has(lead.email)) return false;
    seen.add(lead.email);
    return true;
  });

  if (deduped.length === 0) {
    return NextResponse.json({ added: 0, skippedDuplicate: 0, message: 'Aucune entreprise avec un email exploitable trouvée dans ces fichiers.' });
  }

  // Ne jamais recontacter une entreprise déjà dans la file (en attente,
  // déjà envoyée, ou déjà en échec) — c'est exactement le risque identifié
  // sur les boards Monday, jamais fiables à 100% sur qui a déjà été
  // contacté. La source de vérité reste cette table.
  const { data: existing } = await auth.supabaseAdmin
    .from('prospecting_emails')
    .select('recipient_email');
  const existingEmails = new Set((existing ?? []).map((e) => e.recipient_email.toLowerCase()));

  const newLeads = deduped.filter((lead) => !existingEmails.has(lead.email));
  const skippedDuplicate = deduped.length - newLeads.length;

  if (newLeads.length === 0) {
    return NextResponse.json({ added: 0, skippedDuplicate, message: 'Toutes les entreprises trouvées sont déjà dans la file ou ont déjà été contactées.' });
  }

  const drafted = await draftProspectEmailsBatch(newLeads);

  const toInsert = drafted
    .filter((d) => d.subject && d.body)
    .map((d) => ({
      company_name: d.company || null,
      recipient_email: d.email,
      subject: d.subject,
      body: d.body,
      created_by: auth.userId,
    }));

  if (toInsert.length === 0) {
    return NextResponse.json({ error: 'La génération des emails a échoué — réessaie.' }, { status: 500 });
  }

  const { error: insertError } = await auth.supabaseAdmin.from('prospecting_emails').insert(toInsert);
  if (insertError) return NextResponse.json({ error: 'Ajout à la file échoué.' }, { status: 500 });

  // Répartition par langue détectée automatiquement — affichée pour que
  // l'admin puisse vérifier d'un coup d'œil que ça correspond aux pays
  // du fichier importé, sans avoir à ouvrir chaque brouillon.
  const languageByEmail = new Map(newLeads.map((lead) => [lead.email, lead.language]));
  const languageBreakdown: Record<string, number> = {};
  for (const row of toInsert) {
    const lang = languageByEmail.get(row.recipient_email) ?? 'en';
    languageBreakdown[lang] = (languageBreakdown[lang] ?? 0) + 1;
  }

  return NextResponse.json({ added: toInsert.length, skippedDuplicate, languageBreakdown });
}
