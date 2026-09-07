import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireOwnerId } from '@/lib/team';
import { logAuditEvent } from '@/lib/auditLog';

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

  // Rien à révoquer côté Paddle (pas d'OAuth, voir app/api/paddle/connect) —
  // supprimer la ligne suffit à couper l'accès, la clé n'est plus lue nulle
  // part une fois la ligne effacée.
  const { error } = await supabaseAdmin.from('paddle_connection').delete().eq('account_id', ownerId);
  if (error) {
    console.error('[paddle/connect/disconnect] failed', JSON.stringify({ ownerId, error }));
    return NextResponse.json({ error: 'Impossible de déconnecter Paddle.' }, { status: 500 });
  }

  await logAuditEvent(supabaseAdmin, ownerId, 'paddle_disconnected');
  return NextResponse.json({ disconnected: true });
}
