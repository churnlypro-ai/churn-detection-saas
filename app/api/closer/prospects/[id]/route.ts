import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isCloserEmail } from '@/lib/closer';

const VALID_STATUSES = new Set(['to_call', 'interested', 'not_interested', 'no_answer', 'callback']);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  const closerEmail = userData?.user?.email;
  if (!isCloserEmail(closerEmail)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { status, notes } = body ?? {};
  if (typeof status !== 'string' || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
  }

  // File partagée (voir /api/closer/prospects) : quand un closer marque un
  // résultat, on exige que le prospect soit encore 'to_call' — sans ça, deux
  // closers qui appellent la même personne en même temps pourraient
  // s'écraser l'un l'autre (le second écrase le résultat du premier sans le
  // savoir). Cette garde ne s'applique pas si on remet explicitement à
  // 'to_call' (annulation), qui doit rester possible depuis n'importe quel
  // statut.
  let query = supabaseAdmin
    .from('cold_call_prospects')
    .update({
      status,
      notes: typeof notes === 'string' ? notes.trim() || null : undefined,
      called_by: status === 'to_call' ? null : closerEmail,
      called_at: status === 'to_call' ? null : new Date().toISOString(),
    })
    .eq('id', params.id);
  if (status !== 'to_call') query = query.eq('status', 'to_call');

  const { data, error } = await query.select('id');

  if (error) return NextResponse.json({ error: 'Mise à jour échouée.' }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: 'Ce prospect vient d\'être traité par un autre closer.' }, { status: 409 });
  return NextResponse.json({ success: true });
}
