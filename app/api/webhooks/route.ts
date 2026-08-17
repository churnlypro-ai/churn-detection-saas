import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireOwnerId } from '@/lib/team';

const MAX_WEBHOOKS = 5;

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const ownerId = await requireOwnerId(supabaseAdmin, token);
  if (!ownerId) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const { data: webhooks } = await supabaseAdmin
    .from('webhooks')
    .select('id, url, enabled, created_at')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false });

  return NextResponse.json({ webhooks: webhooks ?? [] });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const ownerId = await requireOwnerId(supabaseAdmin, token);
  if (!ownerId) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { url } = body ?? {};
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }
  if (parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Webhook URL must use HTTPS' }, { status: 400 });
  }

  const { count } = await supabaseAdmin
    .from('webhooks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ownerId);
  if ((count ?? 0) >= MAX_WEBHOOKS) {
    return NextResponse.json({ error: `Limite de ${MAX_WEBHOOKS} webhooks atteinte.` }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('webhooks').insert({ user_id: ownerId, url });
  if (error) {
    console.error('[webhooks] insert failed', JSON.stringify({ ownerId, error }));
    return NextResponse.json({ error: 'Impossible de créer le webhook.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
