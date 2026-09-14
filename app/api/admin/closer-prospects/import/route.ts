import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

// Import en masse pour la file d'appels à froid (cold_call_prospects, voir
// /closer) — distinct de /api/admin/prospecting/import-file : ici les
// colonnes sont déjà structurées (nom, entreprise, téléphone, secteur) dans
// un annuaire d'entreprises (Pappers, data.gouv.fr...), donc pas besoin d'un
// appel Claude pour extraire/rédiger quoi que ce soit, juste un parsing
// direct + validation + dédoublonnage.
export const maxDuration = 60;

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return null;
  return supabaseAdmin;
}

interface IncomingFile {
  filename: string;
  contentBase64: string;
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const NAME_KEYS = new Set(['name', 'nom', 'contact', 'contactname']);
const COMPANY_KEYS = new Set(['company', 'companyname', 'entreprise', 'societe', 'raisonsociale', 'nomcommercial']);
const PHONE_KEYS = new Set(['phone', 'telephone', 'tel', 'numero', 'numerodetelephone']);
const SECTOR_KEYS = new Set(['sector', 'secteur', 'activite', 'activiteprincipale', 'naf', 'codenaf']);

function pickField(row: Record<string, unknown>, keys: Set<string>): string {
  for (const key of Object.keys(row)) {
    if (keys.has(normalizeHeader(key))) {
      const value = row[key];
      if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
    }
  }
  return '';
}

// Un numéro exploitable a au moins 8 chiffres — filtre automatiquement les
// placeholders ("à confirmer", "non trouvé", vide) qu'on a dû exclure à la
// main jusqu'ici sur les imports par lot de 10-20.
function isPlausiblePhone(phone: string): boolean {
  return phone.replace(/\D/g, '').length >= 8;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function parseRows(file: IncomingFile): Record<string, unknown>[] {
  if (!file.contentBase64) return [];
  const buffer = Buffer.from(file.contentBase64, 'base64');
  // .xlsx/.xls sont un format binaire (zip) : doit rester lu en 'buffer'.
  // .csv/.txt sont du texte — les relire en UTF-8 puis parser en 'string'
  // évite un mojibake sur les accents (XLSX.read en 'buffer' sur du texte
  // brut suppose un autre encodage par défaut et casse "Éric" en "Ãric").
  const isBinarySpreadsheet = /\.(xlsx|xls)$/i.test(file.filename);
  try {
    const workbook = isBinarySpreadsheet
      ? XLSX.read(buffer, { type: 'buffer' })
      : XLSX.read(buffer.toString('utf-8'), { type: 'string' });
    const rows: Record<string, unknown>[] = [];
    for (const sheetName of workbook.SheetNames) {
      rows.push(...XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' }));
    }
    return rows;
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = await requireAdmin(req);
  if (!supabaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const files: IncomingFile[] = Array.isArray(body?.files) ? body.files : [];
  if (files.length === 0) {
    return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 });
  }

  const allRows = files.flatMap((f) => parseRows(f));
  if (allRows.length === 0) {
    return NextResponse.json({ error: 'Aucune ligne exploitable dans ces fichiers.' }, { status: 400 });
  }

  const extracted = allRows
    .map((row) => ({
      name: pickField(row, NAME_KEYS),
      company_name: pickField(row, COMPANY_KEYS),
      phone: pickField(row, PHONE_KEYS),
      sector: pickField(row, SECTOR_KEYS) || null,
    }))
    .filter((p) => p.name && p.company_name && isPlausiblePhone(p.phone));

  const skippedInvalid = allRows.length - extracted.length;

  // Dédoublonnage à la fois au sein du fichier importé et contre la file
  // existante — un même numéro ne doit jamais être ajouté deux fois, qu'il
  // vienne de ce lot ou d'un lot précédent.
  const { data: existingRows } = await supabaseAdmin.from('cold_call_prospects').select('phone');
  const existingPhones = new Set((existingRows ?? []).map((r) => normalizePhone(r.phone)));

  const seenInBatch = new Set<string>();
  const toInsert: { name: string; company_name: string; phone: string; sector: string | null }[] = [];
  let skippedDuplicate = 0;

  for (const p of extracted) {
    const key = normalizePhone(p.phone);
    if (existingPhones.has(key) || seenInBatch.has(key)) {
      skippedDuplicate++;
      continue;
    }
    seenInBatch.add(key);
    toInsert.push(p);
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ added: 0, skippedInvalid, skippedDuplicate, message: 'Rien de nouveau à ajouter — tout est déjà dans la file ou sans numéro exploitable.' });
  }

  const { error: insertError } = await supabaseAdmin.from('cold_call_prospects').insert(toInsert);
  if (insertError) {
    console.error('[admin/closer-prospects/import] insert failed', insertError);
    return NextResponse.json({ error: 'Ajout à la file échoué.' }, { status: 500 });
  }

  return NextResponse.json({ added: toInsert.length, skippedInvalid, skippedDuplicate });
}
