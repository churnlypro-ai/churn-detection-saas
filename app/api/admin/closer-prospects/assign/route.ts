import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return null;
  return supabaseAdmin;
}

export async function GET(req: NextRequest) {
  const supabaseAdmin = await requireAdmin(req);
  if (!supabaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { count, error } = await supabaseAdmin
    .from('cold_call_prospects')
    .select('id', { count: 'exact', head: true })
    .is('assigned_to', null)
    .eq('status', 'to_call');

  if (error) return NextResponse.json({ error: 'Lecture échouée.' }, { status: 500 });
  return NextResponse.json({ unassigned: count ?? 0 });
}

// Répartit les prospects déjà en base (importés avant l'assignation par
// closer, ou laissés volontairement sans destinataire) — prend les N plus
// anciens prospects non assignés et statut 'to_call', les attribue à
// closerEmail. Appelé une fois par closer pour répartir un même lot entre
// plusieurs personnes (voir /admin/closer-prospects).
export async function POST(req: NextRequest) {
  const supabaseAdmin = await requireAdmin(req);
  if (!supabaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const closerEmail = typeof body?.closerEmail === 'string' ? body.closerEmail.trim() : '';
  const count = typeof body?.count === 'number' && body.count > 0 ? Math.min(body.count, 1000) : 20;

  if (!closerEmail) {
    return NextResponse.json({ error: 'Email du closer requis.' }, { status: 400 });
  }

  const { data: candidates, error: fetchError } = await supabaseAdmin
    .from('cold_call_prospects')
    .select('id')
    .is('assigned_to', null)
    .eq('status', 'to_call')
    .order('created_at', { ascending: true })
    .limit(count);

  if (fetchError) return NextResponse.json({ error: 'Lecture échouée.' }, { status: 500 });

  const ids = (candidates ?? []).map((c) => c.id);
  if (ids.length === 0) {
    return NextResponse.json({ assigned: 0, message: 'Aucun prospect non assigné disponible.' });
  }

  const { error: updateError } = await supabaseAdmin
    .from('cold_call_prospects')
    .update({ assigned_to: closerEmail })
    .in('id', ids);

  if (updateError) return NextResponse.json({ error: 'Assignation échouée.' }, { status: 500 });

  return NextResponse.json({ assigned: ids.length });
}
