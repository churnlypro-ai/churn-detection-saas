import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { extractLinkedInLeadsFromRawText, type ExtractedLinkedInLead } from '@/lib/linkedinProspectingDraft';
import { isMissingTableError, missingTableMessage } from '@/lib/supabaseErrors';

const MIGRATION_FILE = '20260828000000_add_linkedin_prospecting.sql';

// Extraction par fichier, potentiellement plusieurs fichiers — même raison
// que /api/admin/prospecting/import-file : largement au-delà des 15s par
// défaut d'une fonction Vercel.
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

// Enlève aussi la query string et le fragment (ex: "?miniProfileUrn=..."
// que LinkedIn ajoute souvent aux liens partagés) — sans ça, deux liens
// vers le même profil avec des paramètres de tracking différents ne
// seraient pas reconnus comme doublons.
function normalizeLinkedinUrl(url: string): string {
  return url.trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');
}

export async function POST(req: NextRequest) {
  try {
    return await handleImport(req);
  } catch (err) {
    // Filet de sécurité : sans ça, une exception inattendue fait renvoyer
    // à Next.js une page d'erreur non-JSON, que le front interprète comme
    // le message générique "Import échoué." sans aucune piste de cause.
    console.error('[prospecting/linkedin/import-file] unexpected error', err);
    return NextResponse.json({ error: 'Erreur inattendue pendant l\'import — réessaie. Si ça persiste, vérifie que la migration Supabase a bien été appliquée.' }, { status: 500 });
  }
}

async function handleImport(req: NextRequest) {
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
  const allLeads: ExtractedLinkedInLead[] = [];
  for (let i = 0; i < rawTexts.length; i += EXTRACT_CONCURRENCY) {
    const chunk = rawTexts.slice(i, i + EXTRACT_CONCURRENCY);
    const results = await Promise.all(chunk.map((t) => extractLinkedInLeadsFromRawText(t).catch(() => [] as ExtractedLinkedInLead[])));
    for (const r of results) allLeads.push(...r);
  }

  // Dédoublonnage au sein de ce lot (une même personne peut apparaître dans
  // plusieurs fichiers/feuilles collés dans le même import).
  const seen = new Set<string>();
  const deduped = allLeads.filter((lead) => {
    const key = normalizeLinkedinUrl(lead.linkedinUrl);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (deduped.length === 0) {
    return NextResponse.json({ added: 0, skippedDuplicate: 0, message: 'Aucun profil LinkedIn exploitable (nom + lien + message) trouvé dans ces fichiers.' });
  }

  // Ne jamais recontacter une personne déjà dans la file (en attente ou déjà
  // marquée envoyée) — même principe que la prospection email.
  const { data: existing, error: existingError } = await auth.supabaseAdmin
    .from('linkedin_prospecting')
    .select('linkedin_url');
  if (existingError) {
    console.error('[prospecting/linkedin/import-file] existing lookup failed', existingError);
    return NextResponse.json(
      { error: isMissingTableError(existingError) ? missingTableMessage(MIGRATION_FILE) : 'Lecture de la file existante échouée.' },
      { status: 500 },
    );
  }
  const existingUrls = new Set((existing ?? []).map((e) => normalizeLinkedinUrl(e.linkedin_url)));

  const newLeads = deduped.filter((lead) => !existingUrls.has(normalizeLinkedinUrl(lead.linkedinUrl)));
  const skippedDuplicate = deduped.length - newLeads.length;

  if (newLeads.length === 0) {
    return NextResponse.json({ added: 0, skippedDuplicate, message: 'Tous les profils trouvés sont déjà dans la file ou ont déjà été contactés.' });
  }

  const toInsert = newLeads.map((lead) => ({
    contact_name: lead.contactName,
    linkedin_url: lead.linkedinUrl,
    message: lead.message,
    created_by: auth.userId,
  }));

  const { error: insertError } = await auth.supabaseAdmin.from('linkedin_prospecting').insert(toInsert);
  if (insertError) {
    console.error('[prospecting/linkedin/import-file] insert failed', insertError);
    return NextResponse.json(
      { error: isMissingTableError(insertError) ? missingTableMessage(MIGRATION_FILE) : 'Ajout à la file échoué.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ added: toInsert.length, skippedDuplicate });
}
