import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { isMissingTableError, missingTableMessage } from '@/lib/supabaseErrors';

const MIGRATION_FILE = '20260907000000_add_x_prospecting.sql';

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return null;
  return { supabaseAdmin, userId: userData!.user!.id };
}

// Ancré sur le protocole + le nom d'hôte, pas juste "contient la
// sous-chaîne" — voir lib/xProspectingDraft.ts pour le détail du
// raisonnement (sinon "notx.com/y" passerait la vérification). x.com et
// twitter.com pointent tous les deux vers les mêmes profils.
const X_URL_PATTERN = /^https?:\/\/(www\.)?(x\.com|twitter\.com)\/[a-zA-Z0-9_]+\/?(\?.*)?$/i;

// Même normalisation que import-file/route.ts (enlève query string et
// slash final) — un ajout manuel ou un collage en masse répété du même
// bloc ne créait auparavant aucune erreur, juste un doublon silencieux
// dans la file (voir la même correction sur l'endpoint Instagram).
function normalizeXUrl(url: string): string {
  return url.trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?twitter\.com\//, 'https://x.com/');
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Plafond largement au-dessus du volume attendu (des lots de plusieurs
  // centaines de contacts, préparés à l'avance pour tenir un mois) — un
  // plafond trop bas ici masquerait silencieusement les plus anciens de la
  // file sans erreur visible.
  const { data, error } = await auth.supabaseAdmin
    .from('x_prospecting')
    .select('id, contact_name, x_url, message, status, created_at, sent_at')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('[prospecting/x] list failed', error);
    return NextResponse.json(
      { error: isMissingTableError(error) ? missingTableMessage(MIGRATION_FILE) : 'Chargement échoué.' },
      { status: 500 },
    );
  }
  return NextResponse.json({ contacts: data });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { contactName, xUrl, message } = body ?? {};

  if (typeof contactName !== 'string' || !contactName.trim()) {
    return NextResponse.json({ error: 'Nom requis.' }, { status: 400 });
  }
  if (typeof xUrl !== 'string' || !X_URL_PATTERN.test(xUrl.trim())) {
    return NextResponse.json({ error: 'Lien X invalide (doit commencer par https://x.com/... ou https://twitter.com/...).' }, { status: 400 });
  }
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message requis.' }, { status: 400 });
  }

  const normalizedUrl = normalizeXUrl(xUrl);
  const { data: existing, error: existingError } = await auth.supabaseAdmin
    .from('x_prospecting')
    .select('x_url');
  if (existingError) {
    console.error('[prospecting/x] existing lookup failed', existingError);
    return NextResponse.json(
      { error: isMissingTableError(existingError) ? missingTableMessage(MIGRATION_FILE) : 'Vérification des doublons échouée.' },
      { status: 500 },
    );
  }
  const alreadyQueued = (existing ?? []).some((e) => normalizeXUrl(e.x_url) === normalizedUrl);
  if (alreadyQueued) {
    return NextResponse.json({ error: 'Ce profil est déjà dans la file (ou a déjà été contacté).' }, { status: 409 });
  }

  const { error } = await auth.supabaseAdmin.from('x_prospecting').insert({
    contact_name: contactName.trim(),
    x_url: xUrl.trim(),
    message: message.trim(),
    created_by: auth.userId,
  });

  if (error) {
    console.error('[prospecting/x] insert failed', error);
    return NextResponse.json(
      { error: isMissingTableError(error) ? missingTableMessage(MIGRATION_FILE) : 'Ajout échoué.' },
      { status: 500 },
    );
  }
  return NextResponse.json({ success: true });
}
