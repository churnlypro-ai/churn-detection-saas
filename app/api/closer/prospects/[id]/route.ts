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

  // Un prospect appartient à un seul closer (voir /admin/closer-prospects et
  // la migration add_prospect_assignment) — sans ce filtre, n'importe quel
  // closer authentifié pourrait modifier le statut d'un prospect assigné à
  // un autre en devinant/rejouant son id, ce qui casserait exactement la
  // séparation par closer voulue.
  const { data, error } = await supabaseAdmin
    .from('cold_call_prospects')
    .update({
      status,
      notes: typeof notes === 'string' ? notes.trim() || null : undefined,
      called_by: status === 'to_call' ? null : closerEmail,
      called_at: status === 'to_call' ? null : new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('assigned_to', closerEmail)
    .select('id');

  if (error) return NextResponse.json({ error: 'Mise à jour échouée.' }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: 'Ce prospect ne vous est pas assigné.' }, { status: 403 });
  return NextResponse.json({ success: true });
}
