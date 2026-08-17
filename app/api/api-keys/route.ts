import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateApiKey } from '@/lib/apiKeys';
import { requireOwnerId } from '@/lib/team';

const MAX_API_KEYS = 5;

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const ownerId = await requireOwnerId(supabaseAdmin, token);
  if (!ownerId) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const { data: keys } = await supabaseAdmin
    .from('api_keys')
    .select('id, key_prefix, label, created_at, last_used_at')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false });

  return NextResponse.json({ keys: keys ?? [] });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const ownerId = await requireOwnerId(supabaseAdmin, token);
  if (!ownerId) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const { count } = await supabaseAdmin
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ownerId);
  if ((count ?? 0) >= MAX_API_KEYS) {
    return NextResponse.json({ error: `Limite de ${MAX_API_KEYS} clés atteinte.` }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { label } = body ?? {};

  const { plaintext, hash, prefix } = generateApiKey();

  const { error } = await supabaseAdmin
    .from('api_keys')
    .insert({ user_id: ownerId, key_hash: hash, key_prefix: prefix, label: typeof label === 'string' ? label.slice(0, 100) : null });

  if (error) {
    console.error('[api-keys] insert failed', JSON.stringify({ ownerId, error }));
    return NextResponse.json({ error: 'Impossible de créer la clé.' }, { status: 500 });
  }

  // Seule occasion où la clé en clair est renvoyée — jamais stockée, jamais
  // récupérable après cette réponse (voir lib/apiKeys.ts).
  return NextResponse.json({ key: plaintext });
}
