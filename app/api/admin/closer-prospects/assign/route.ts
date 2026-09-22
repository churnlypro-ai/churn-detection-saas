import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

// Répartit un lot de N prospects pas encore assignés vers un closer donné
// (voir la migration 20260922000000) — ex: "assigner 25 à Kendal". Ne prend
// que des prospects status='to_call' ET assigned_to IS NULL, les plus
// anciens d'abord (même ordre que /closer), pour ne jamais réassigner un
// prospect déjà donné à quelqu'un d'autre ni déjà traité.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const assignee = typeof body?.assignee === 'string' ? body.assignee.trim().toLowerCase() : '';
  const count = Number(body?.count);

  if (!assignee) return NextResponse.json({ error: 'Email du closer requis.' }, { status: 400 });
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    return NextResponse.json({ error: 'Nombre invalide (1 à 500).' }, { status: 400 });
  }

  const { data: candidates, error: fetchError } = await supabaseAdmin
    .from('cold_call_prospects')
    .select('id')
    .eq('status', 'to_call')
    .is('assigned_to', null)
    .order('created_at', { ascending: true })
    .limit(count);

  if (fetchError) return NextResponse.json({ error: 'Lecture échouée.' }, { status: 500 });
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ assigned: 0, message: 'Aucun prospect non assigné disponible.' });
  }

  const ids = candidates.map((c) => c.id);
  const { error: updateError } = await supabaseAdmin
    .from('cold_call_prospects')
    .update({ assigned_to: assignee })
    .in('id', ids);

  if (updateError) return NextResponse.json({ error: 'Assignation échouée.' }, { status: 500 });

  return NextResponse.json({ assigned: ids.length });
}
