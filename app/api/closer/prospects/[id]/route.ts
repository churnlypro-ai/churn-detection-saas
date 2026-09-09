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

  const { error } = await supabaseAdmin
    .from('cold_call_prospects')
    .update({
      status,
      notes: typeof notes === 'string' ? notes.trim() || null : undefined,
      called_by: status === 'to_call' ? null : closerEmail,
      called_at: status === 'to_call' ? null : new Date().toISOString(),
    })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: 'Mise à jour échouée.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
