import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { keyId } = body ?? {};
  if (!keyId || typeof keyId !== 'string') {
    return NextResponse.json({ error: 'Missing keyId' }, { status: 400 });
  }

  const { error, count } = await supabaseAdmin
    .from('api_keys')
    .delete({ count: 'exact' })
    .eq('id', keyId)
    .eq('user_id', userData.user.id);

  if (error) {
    console.error('[api-keys/revoke] delete failed', JSON.stringify({ userId: userData.user.id, keyId, error }));
    return NextResponse.json({ error: 'Could not revoke key' }, { status: 500 });
  }
  if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}
