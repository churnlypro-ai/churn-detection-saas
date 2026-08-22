import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resolveAccountId } from '@/lib/team';

// Lecture seule : un membre d'équipe doit pouvoir voir que le compte a une
// adresse connectée (utile pour comprendre pourquoi l'envoi groupé est
// disponible) même s'il ne peut pas la connecter/déconnecter lui-même.
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
  const accountId = await resolveAccountId(supabaseAdmin, userData.user.id);

  const { data } = await supabaseAdmin
    .from('customer_email_connection')
    .select('connected_email, updated_at')
    .eq('account_id', accountId)
    .maybeSingle();

  return NextResponse.json({ connected: !!data, connectedEmail: data?.connected_email ?? null });
}
