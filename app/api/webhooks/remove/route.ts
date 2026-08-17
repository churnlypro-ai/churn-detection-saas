import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireOwnerId } from '@/lib/team';

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const ownerId = await requireOwnerId(supabaseAdmin, token);
  if (!ownerId) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { webhookId } = body ?? {};
  if (!webhookId || typeof webhookId !== 'string') {
    return NextResponse.json({ error: 'Missing webhookId' }, { status: 400 });
  }

  const { error, count } = await supabaseAdmin
    .from('webhooks')
    .delete({ count: 'exact' })
    .eq('id', webhookId)
    .eq('user_id', ownerId);

  if (error) {
    console.error('[webhooks/remove] delete failed', JSON.stringify({ ownerId, webhookId, error }));
    return NextResponse.json({ error: 'Could not remove webhook' }, { status: 500 });
  }
  if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}
