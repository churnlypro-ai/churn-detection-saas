import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

const VALID_STATUSES = new Set(['to_contact', 'messaged', 'replied', 'interested', 'not_interested']);
const VALID_PLATFORMS = new Set(['x', 'instagram', 'linkedin', 'other']);

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return null;
  return supabaseAdmin;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAdmin = await requireAdmin(req);
  if (!supabaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body?.name === 'string') {
    if (!body.name.trim()) return NextResponse.json({ error: 'Nom requis.' }, { status: 400 });
    update.name = body.name.trim();
  }
  if (typeof body?.companyName === 'string') {
    if (!body.companyName.trim()) return NextResponse.json({ error: 'Entreprise requise.' }, { status: 400 });
    update.company_name = body.companyName.trim();
  }
  if (body?.website !== undefined) {
    update.website = typeof body.website === 'string' && body.website.trim() ? body.website.trim() : null;
  }
  if (body?.platform !== undefined) {
    if (typeof body.platform !== 'string' || !VALID_PLATFORMS.has(body.platform)) {
      return NextResponse.json({ error: 'Plateforme invalide.' }, { status: 400 });
    }
    update.platform = body.platform;
  }
  if (body?.handle !== undefined) {
    update.handle = typeof body.handle === 'string' && body.handle.trim() ? body.handle.trim() : null;
  }
  if (body?.email !== undefined) {
    update.email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null;
  }
  if (body?.notes !== undefined) {
    update.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
  }
  if (body?.suggestedMessage !== undefined) {
    update.suggested_message = typeof body.suggestedMessage === 'string' && body.suggestedMessage.trim() ? body.suggestedMessage.trim() : null;
  }
  if (body?.status !== undefined) {
    if (typeof body.status !== 'string' || !VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
    }
    update.status = body.status;
  }
  if (body?.contactedBy !== undefined) {
    update.contacted_by = typeof body.contactedBy === 'string' && body.contactedBy.trim() ? body.contactedBy.trim() : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucune modification fournie.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('social_prospects')
    .update(update)
    .eq('id', params.id)
    .select('id, name, company_name, website, platform, handle, email, notes, suggested_message, status, contacted_by, contacted_at, created_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Modification échouée.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Prospect introuvable.' }, { status: 404 });
  return NextResponse.json({ prospect: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAdmin = await requireAdmin(req);
  if (!supabaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabaseAdmin.from('social_prospects').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Suppression échouée.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
