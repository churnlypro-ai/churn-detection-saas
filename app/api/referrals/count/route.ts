import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { percentOffForCount } from '@/lib/referralRewards';

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
    return NextResponse.json({ code: null, count: 0, currentMonthPayingCount: 0, nextRewardPercent: 0 });
  }

  const { count } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by', profile.referral_code);

  // Filleuls devenus clients payants depuis le début du mois en cours — ce
  // qui compte pour la récompense appliquée le 1er du mois suivant (voir
  // lib/referralRewards.ts). Affiché dans /settings comme une progression
  // "X/3 ce mois-ci", séparée du compteur lifetime ci-dessus.
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString();
  const { count: currentMonthPayingCount } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by', profile.referral_code)
    .gte('became_paying_at', monthStart);

  return NextResponse.json({
    code: profile.referral_code,
    count: count ?? 0,
    currentMonthPayingCount: currentMonthPayingCount ?? 0,
    nextRewardPercent: percentOffForCount(currentMonthPayingCount ?? 0),
  });
}
