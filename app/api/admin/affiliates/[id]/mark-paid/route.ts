import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

// Marque TOUTES les commissions "pending" de cet affilié comme payées d'un
// coup — correspond à un vrai virement groupé fait manuellement (voir la
// note dans la migration : cette route ne fait jamais l'envoi d'argent
// elle-même, juste le suivi après coup).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabaseAdmin
    .from('affiliate_commissions')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('affiliate_id', params.id)
    .eq('status', 'pending');

  if (error) return NextResponse.json({ error: 'Mise à jour échouée.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
