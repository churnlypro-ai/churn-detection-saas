import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

const VALID_STATUSES = new Set(['to_contact', 'messaged', 'replied', 'interested', 'not_interested']);
const VALID_PLATFORMS = new Set(['x', 'instagram', 'linkedin', 'other']);

// Vue d'ensemble des prospects trouvés via les réseaux (voir la migration
// 20260920000000) — pendant équivalent de /api/admin/closer-prospects mais
// pour du DM plutôt que de l'appel.
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('social_prospects')
    .select('id, name, company_name, website, platform, handle, email, notes, suggested_message, status, contacted_by, contacted_at, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Lecture échouée.' }, { status: 500 });

  const prospects = data ?? [];
  const counts = {
    total: prospects.length,
    to_contact: prospects.filter((p) => p.status === 'to_contact').length,
    messaged: prospects.filter((p) => p.status === 'messaged').length,
    replied: prospects.filter((p) => p.status === 'replied').length,
    interested: prospects.filter((p) => p.status === 'interested').length,
    not_interested: prospects.filter((p) => p.status === 'not_interested').length,
  };

  return NextResponse.json({ prospects, counts });
}

// Ajout à l'unité — pour un prospect trouvé manuellement (ex: dans un fil X)
// plutôt que par lot. Voir POST /import pour l'ajout en masse.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : '';
  const website = typeof body?.website === 'string' && body.website.trim() ? body.website.trim() : null;
  const platform = typeof body?.platform === 'string' && VALID_PLATFORMS.has(body.platform) ? body.platform : 'other';
  const handle = typeof body?.handle === 'string' && body.handle.trim() ? body.handle.trim() : null;
  const email = typeof body?.email === 'string' && body.email.trim() ? body.email.trim() : null;
  const notes = typeof body?.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
  const suggestedMessage = typeof body?.suggestedMessage === 'string' && body.suggestedMessage.trim() ? body.suggestedMessage.trim() : null;
  const status = typeof body?.status === 'string' && VALID_STATUSES.has(body.status) ? body.status : 'to_contact';

  if (!name || !companyName) {
    return NextResponse.json({ error: 'Nom et entreprise requis.' }, { status: 400 });
  }
  if (!website && !handle) {
    return NextResponse.json({ error: 'Site ou identifiant réseau social requis.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('social_prospects')
    .insert({
      name,
      company_name: companyName,
      website,
      platform,
      handle,
      email,
      notes,
      suggested_message: suggestedMessage,
      status,
      contacted_by: status === 'to_contact' ? null : (typeof body?.contactedBy === 'string' && body.contactedBy.trim() ? body.contactedBy.trim() : null),
      contacted_at: status === 'to_contact' ? null : new Date().toISOString(),
    })
    .select('id, name, company_name, website, platform, handle, email, notes, suggested_message, status, contacted_by, contacted_at, created_at')
    .single();

  if (error) return NextResponse.json({ error: 'Ajout échoué.' }, { status: 500 });
  return NextResponse.json({ prospect: data });
}
