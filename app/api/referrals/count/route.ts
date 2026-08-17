import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Chaque compte a son propre code (généré à la création, voir
// handle_new_user dans la migration correspondante) — pas de restriction
// propriétaire/membre ici, un membre d'équipe a aussi son lien personnel.
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('referral_code')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (!profile?.referral_code) {
    return NextResponse.json({ code: null, count: 0 });
  }

  const { count } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by', profile.referral_code);

  return NextResponse.json({ code: profile.referral_code, count: count ?? 0 });
}
