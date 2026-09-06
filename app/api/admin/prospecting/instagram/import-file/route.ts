import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { extractInstagramLeadsFromRawText, parseStructuredInstagramBlocks, type ExtractedInstagramLead } from '@/lib/instagramProspectingDraft';
import { isMissingTableError, missingTableMessage } from '@/lib/supabaseErrors';

const MIGRATION_FILE = '20260906000000_add_instagram_prospecting.sql';

// Extraction par fichier, potentiellement plusieurs fichiers — même raison
// que /api/admin/prospecting/linkedin/import-file : largement au-delà des
// 15s par défaut d'une fonction Vercel.
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

// Enlève aussi la query string et le fragment — même raison que
// normalizeLinkedinUrl dans le fichier LinkedIn équivalent : sans ça, deux
// liens vers le même profil avec des paramètres de tracking différents ne
// seraient pas reconnus comme doublons.
function normalizeInstagramUrl(url: string): string {
  return url.trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');
}

export async function POST(req: NextRequest) {
  try {
    return await handleImport(req);
  } catch (err) {
    // Filet de sécurité : sans ça, une exception inattendue fait renvoyer
    // à Next.js une page d'erreur non-JSON, que le front interprète comme
    // le message générique "Import échoué." sans aucune piste de cause.
    console.error('[prospecting/instagram/import-file] unexpected error', err);
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

  // Essai déterministe d'abord (format name:/url:/message: déjà structuré,
  // voir parseStructuredInstagramBlocks) : fiable, gratuit, et sans le
  // risque de troncature d'un appel IA sur un gros lot de messages longs.
  // Seuls les fichiers où ça ne trouve rien passent par l'extraction IA
  // (texte brut non structuré).
  const needsAiExtraction: string[] = [];
  const allLeads: ExtractedInstagramLead[] = [];
  for (const rawText of rawTexts) {
    const structured = parseStructuredInstagramBlocks(rawText);
    if (structured.length > 0) allLeads.push(...structured);
    else needsAiExtraction.push(rawText);
  }

  // Extraction IA bornée en parallèle — un appel Claude par fichier/feuille
  // restant, uniquement pour ceux qui n'étaient pas dans le format structuré.
  for (let i = 0; i < needsAiExtraction.length; i += EXTRACT_CONCURRENCY) {
    const chunk = needsAiExtraction.slice(i, i + EXTRACT_CONCURRENCY);
    const results = await Promise.all(chunk.map((t) => extractInstagramLeadsFromRawText(t).catch(() => [] as ExtractedInstagramLead[])));
    for (const r of results) allLeads.push(...r);
  }

  // Dédoublonnage au sein de ce lot (une même personne peut apparaître dans
  // plusieurs fichiers/feuilles collés dans le même import).
  const seen = new Set<string>();
  const deduped = allLeads.filter((lead) => {
    const key = normalizeInstagramUrl(lead.instagramUrl);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (deduped.length === 0) {
    return NextResponse.json({ added: 0, skippedDuplicate: 0, message: 'Aucun profil Instagram exploitable (nom + lien + message) trouvé dans ces fichiers.' });
  }

  // Ne jamais recontacter une personne déjà dans la file (en attente ou déjà
  // marquée envoyée) — même principe que la prospection email/LinkedIn.
  const { data: existing, error: existingError } = await auth.supabaseAdmin
    .from('instagram_prospecting')
    .select('instagram_url');
  if (existingError) {
    console.error('[prospecting/instagram/import-file] existing lookup failed', existingError);
    return NextResponse.json(
      { error: isMissingTableError(existingError) ? missingTableMessage(MIGRATION_FILE) : 'Lecture de la file existante échouée.' },
      { status: 500 },
    );
  }
  const existingUrls = new Set((existing ?? []).map((e) => normalizeInstagramUrl(e.instagram_url)));

  const newLeads = deduped.filter((lead) => !existingUrls.has(normalizeInstagramUrl(lead.instagramUrl)));
  const skippedDuplicate = deduped.length - newLeads.length;

  if (newLeads.length === 0) {
    return NextResponse.json({ added: 0, skippedDuplicate, message: 'Tous les profils trouvés sont déjà dans la file ou ont déjà été contactés.' });
  }

  const toInsert = newLeads.map((lead) => ({
    contact_name: lead.contactName,
    instagram_url: lead.instagramUrl,
    message: lead.message,
    created_by: auth.userId,
  }));

  const { error: insertError } = await auth.supabaseAdmin.from('instagram_prospecting').insert(toInsert);
  if (insertError) {
    console.error('[prospecting/instagram/import-file] insert failed', insertError);
    return NextResponse.json(
      { error: isMissingTableError(insertError) ? missingTableMessage(MIGRATION_FILE) : 'Ajout à la file échoué.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ added: toInsert.length, skippedDuplicate });
}
