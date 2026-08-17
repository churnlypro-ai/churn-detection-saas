import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { memberId } = body ?? {};
  if (!memberId || typeof memberId !== 'string') {
    return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });
  }

  // Filtré par owner_user_id = appelant : empêche un membre (ou n'importe
  // qui d'autre) de retirer un membre d'un compte qui n'est pas le sien.
  const { error, count } = await supabaseAdmin
    .from('team_members')
    .delete({ count: 'exact' })
    .eq('id', memberId)
    .eq('owner_user_id', userData.user.id);

  if (error) {
    console.error('[team/remove] delete failed', JSON.stringify({ ownerId: userData.user.id, memberId, error }));
    return NextResponse.json({ error: 'Could not remove team member' }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
