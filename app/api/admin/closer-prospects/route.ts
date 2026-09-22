import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

const VALID_STATUSES = new Set(['to_call', 'interested', 'not_interested', 'no_answer', 'callback']);

// Vue d'ensemble pour l'admin (pas forcément un closer lui-même) : voir qui
// a été appelé ou non, par qui, avec quel résultat — sans passer par /closer
// qui est réservé aux emails de CLOSER_EMAILS.
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('cold_call_prospects')
    .select('id, name, company_name, phone, sector, status, notes, called_by, called_at, assigned_to, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Lecture échouée.' }, { status: 500 });

  const prospects = data ?? [];
  const counts = {
    total: prospects.length,
    to_call: prospects.filter((p) => p.status === 'to_call').length,
    interested: prospects.filter((p) => p.status === 'interested').length,
    callback: prospects.filter((p) => p.status === 'callback').length,
    no_answer: prospects.filter((p) => p.status === 'no_answer').length,
    not_interested: prospects.filter((p) => p.status === 'not_interested').length,
    unassigned: prospects.filter((p) => p.status === 'to_call' && !p.assigned_to).length,
  };

  return NextResponse.json({ prospects, counts });
}

// Ajout à l'unité — pour un prospect appelé en dehors de tout import (ex:
// Kendal a appelé des gens hors liste) : permet de le tracer après coup,
// éventuellement déjà avec un résultat (status/notes/calledBy) plutôt que
// forcément 'to_call'. L'import en masse (POST /import) reste la voie pour
// un gros lot.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : '';
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
  const sector = typeof body?.sector === 'string' && body.sector.trim() ? body.sector.trim() : null;
  const status = typeof body?.status === 'string' && VALID_STATUSES.has(body.status) ? body.status : 'to_call';
  const notes = typeof body?.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
  const calledBy = typeof body?.calledBy === 'string' && body.calledBy.trim() ? body.calledBy.trim() : null;
  const assignedTo = typeof body?.assignedTo === 'string' && body.assignedTo.trim() ? body.assignedTo.trim().toLowerCase() : null;

  if (!name || !companyName) {
    return NextResponse.json({ error: 'Nom et entreprise requis.' }, { status: 400 });
  }
  if (phone.replace(/\D/g, '').length < 8) {
    return NextResponse.json({ error: 'Numéro de téléphone invalide.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('cold_call_prospects')
    .insert({
      name,
      company_name: companyName,
      phone,
      sector,
      status,
      notes,
      called_by: status === 'to_call' ? null : calledBy,
      called_at: status === 'to_call' ? null : new Date().toISOString(),
      assigned_to: assignedTo,
    })
    .select('id, name, company_name, phone, sector, status, notes, called_by, called_at, assigned_to, created_at')
    .single();

  if (error) return NextResponse.json({ error: 'Ajout échoué.' }, { status: 500 });
  return NextResponse.json({ prospect: data });
}
