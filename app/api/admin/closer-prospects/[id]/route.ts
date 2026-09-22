import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

const VALID_STATUSES = new Set(['to_call', 'interested', 'not_interested', 'no_answer', 'callback']);

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return null;
  return supabaseAdmin;
}

// Édition libre depuis l'admin (corriger une coquille, ou reconstituer un
// appel fait hors liste — nom, entreprise, téléphone, secteur, statut,
// notes, qui a appelé et quand) — contrairement à /api/closer/prospects/[id]
// qui ne fait qu'enregistrer un résultat d'appel avec les garde-fous du
// flux closer, celle-ci n'a pas à les respecter : c'est l'admin qui
// corrige/complète après coup.
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
  if (typeof body?.phone === 'string') {
    if (body.phone.replace(/\D/g, '').length < 8) return NextResponse.json({ error: 'Numéro de téléphone invalide.' }, { status: 400 });
    update.phone = body.phone.trim();
  }
  if (body?.sector !== undefined) {
    update.sector = typeof body.sector === 'string' && body.sector.trim() ? body.sector.trim() : null;
  }
  if (body?.status !== undefined) {
    if (typeof body.status !== 'string' || !VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
    }
    update.status = body.status;
  }
  if (body?.notes !== undefined) {
    update.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
  }
  if (body?.calledBy !== undefined) {
    update.called_by = typeof body.calledBy === 'string' && body.calledBy.trim() ? body.calledBy.trim() : null;
  }
  if (body?.assignedTo !== undefined) {
    update.assigned_to = typeof body.assignedTo === 'string' && body.assignedTo.trim() ? body.assignedTo.trim().toLowerCase() : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucune modification fournie.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('cold_call_prospects')
    .update(update)
    .eq('id', params.id)
    .select('id, name, company_name, phone, sector, status, notes, called_by, called_at, assigned_to, created_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Modification échouée.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Prospect introuvable.' }, { status: 404 });
  return NextResponse.json({ prospect: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAdmin = await requireAdmin(req);
  if (!supabaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabaseAdmin.from('cold_call_prospects').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Suppression échouée.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
