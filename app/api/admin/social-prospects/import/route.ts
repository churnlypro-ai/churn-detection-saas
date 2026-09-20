import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

// Import en masse pour les prospects trouvés via les réseaux (voir la
// migration 20260920000000_add_social_prospects) — même mécanique que
// /api/admin/closer-prospects/import, mais dédoublonné sur le site web ou
// l'identifiant réseau social plutôt que sur un numéro de téléphone (aucun
// de ces prospects n'a de téléphone à ce stade).
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
const COMPANY_KEYS = new Set(['company', 'companyname', 'entreprise', 'societe', 'produit', 'product']);
const WEBSITE_KEYS = new Set(['website', 'site', 'siteweb', 'url', 'lien']);
const PLATFORM_KEYS = new Set(['platform', 'plateforme', 'reseau', 'network']);
const HANDLE_KEYS = new Set(['handle', 'identifiant', 'username', 'pseudo']);
const EMAIL_KEYS = new Set(['email', 'mail', 'courriel']);
const NOTES_KEYS = new Set(['notes', 'note', 'remarque', 'remarques']);
const MESSAGE_KEYS = new Set(['suggestedmessage', 'message', 'dm', 'messageperso']);

function pickField(row: Record<string, unknown>, keys: Set<string>): string {
  for (const key of Object.keys(row)) {
    if (keys.has(normalizeHeader(key))) {
      const value = row[key];
      if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
    }
  }
  return '';
}

const VALID_PLATFORMS = new Set(['x', 'instagram', 'linkedin', 'other']);

function normalizePlatform(raw: string): string {
  const v = normalizeHeader(raw);
  if (v === 'x' || v === 'twitter') return 'x';
  if (v === 'instagram' || v === 'insta' || v === 'ig') return 'instagram';
  if (v === 'linkedin') return 'linkedin';
  return VALID_PLATFORMS.has(raw) ? raw : 'other';
}

// Utilisé pour le dédoublonnage — un même site (avec ou sans www/https/trailing
// slash) ne doit compter qu'une fois, quelle que soit la façon dont il a été
// tapé d'un import à l'autre.
function normalizeWebsite(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

function parseRows(file: IncomingFile): Record<string, unknown>[] {
  if (!file.contentBase64) return [];
  const buffer = Buffer.from(file.contentBase64, 'base64');
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
      website: pickField(row, WEBSITE_KEYS) || null,
      platform: normalizePlatform(pickField(row, PLATFORM_KEYS)),
      handle: pickField(row, HANDLE_KEYS) || null,
      email: pickField(row, EMAIL_KEYS) || null,
      notes: pickField(row, NOTES_KEYS) || null,
      suggested_message: pickField(row, MESSAGE_KEYS) || null,
    }))
    .filter((p) => p.name && p.company_name && (p.website || p.handle));

  const skippedInvalid = allRows.length - extracted.length;

  // Clé de dédoublonnage : site normalisé si présent, sinon plateforme+handle
  // — au moins l'un des deux est garanti par le filtre ci-dessus.
  function dedupeKey(p: { website: string | null; platform: string; handle: string | null }): string {
    if (p.website) return `w:${normalizeWebsite(p.website)}`;
    return `h:${p.platform}:${(p.handle ?? '').toLowerCase().replace(/^@/, '')}`;
  }

  const { data: existingRows } = await supabaseAdmin.from('social_prospects').select('website, platform, handle');
  const existingKeys = new Set((existingRows ?? []).map((r) => dedupeKey(r)));

  const seenInBatch = new Set<string>();
  const toInsert: typeof extracted = [];
  let skippedDuplicate = 0;

  for (const p of extracted) {
    const key = dedupeKey(p);
    if (existingKeys.has(key) || seenInBatch.has(key)) {
      skippedDuplicate++;
      continue;
    }
    seenInBatch.add(key);
    toInsert.push(p);
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ added: 0, skippedInvalid, skippedDuplicate, message: 'Rien de nouveau à ajouter — tout est déjà dans la liste ou sans site/identifiant exploitable.' });
  }

  const { error: insertError } = await supabaseAdmin.from('social_prospects').insert(toInsert);
  if (insertError) {
    console.error('[admin/social-prospects/import] insert failed', insertError);
    return NextResponse.json({ error: 'Ajout à la liste échoué.' }, { status: 500 });
  }

  return NextResponse.json({ added: toInsert.length, skippedInvalid, skippedDuplicate });
}
