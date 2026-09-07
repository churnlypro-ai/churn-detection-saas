import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireOwnerId } from '@/lib/team';
import { verifyPaddleApiKey, type PaddleEnvironment } from '@/lib/paddleConnect';
import { encryptSecret } from '@/lib/tokenCrypto';
import { logAuditEvent } from '@/lib/auditLog';

// Contrairement à Stripe Connect (redirection OAuth, voir
// app/api/stripe/connect/start), Paddle n'a pas de "Connect" tiers : le
// client colle directement sa clé API ici. Réservé au propriétaire du
// compte (requireOwnerId), jamais un membre d'équipe — même règle que
// Stripe Connect et la facturation, voir la note dans lib/team.ts.
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
  const environment: PaddleEnvironment = body?.environment === 'sandbox' ? 'sandbox' : 'production';

  if (!apiKey) {
    return NextResponse.json({ error: 'Clé API manquante.' }, { status: 400 });
  }

  try {
    // Jamais fait confiance à une clé collée sans vérification — un
    // premier appel réel valide qu'elle fonctionne avant de l'enregistrer.
    await verifyPaddleApiKey(apiKey, environment);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Clé API Paddle invalide.' },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin
    .from('paddle_connection')
    .upsert(
      { account_id: ownerId, environment, api_key_encrypted: encryptSecret(apiKey), updated_at: new Date().toISOString() },
      { onConflict: 'account_id' },
    );

  if (error) {
    console.error('[paddle/connect] failed to save connection', JSON.stringify({ ownerId, error }));
    return NextResponse.json({ error: 'Impossible d\'enregistrer la connexion Paddle.' }, { status: 500 });
  }

  await logAuditEvent(supabaseAdmin, ownerId, 'paddle_connected', { environment });
  return NextResponse.json({ connected: true });
}
