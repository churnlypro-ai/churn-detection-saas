import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireOwnerId } from '@/lib/team';
import { verifyLemonSqueezyApiKey } from '@/lib/lemonSqueezyConnect';
import { encryptSecret } from '@/lib/tokenCrypto';
import { logAuditEvent } from '@/lib/auditLog';

// Voir app/api/paddle/connect/route.ts pour la même logique (pas d'OAuth
// tiers chez Lemon Squeezy non plus, la clé API est collée directement).
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const ownerId = await requireOwnerId(supabaseAdmin, token);
  if (!ownerId) {
    return NextResponse.json({ error: 'Réservé au propriétaire du compte.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';

  if (!apiKey) {
    return NextResponse.json({ error: 'Clé API manquante.' }, { status: 400 });
  }

  try {
    await verifyLemonSqueezyApiKey(apiKey);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Clé API Lemon Squeezy invalide.' },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin
    .from('lemonsqueezy_connection')
    .upsert(
      { account_id: ownerId, api_key_encrypted: encryptSecret(apiKey), updated_at: new Date().toISOString() },
      { onConflict: 'account_id' },
    );

  if (error) {
    console.error('[lemonsqueezy/connect] failed to save connection', JSON.stringify({ ownerId, error }));
    return NextResponse.json({ error: 'Impossible d\'enregistrer la connexion Lemon Squeezy.' }, { status: 500 });
  }

  await logAuditEvent(supabaseAdmin, ownerId, 'lemonsqueezy_connected');
  return NextResponse.json({ connected: true });
}
