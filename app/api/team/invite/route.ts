import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendTeamInviteEmail } from '@/lib/email';

const MAX_TEAM_MEMBERS = 10;

// Volontairement réservé aux propriétaires : un membre d'équipe ne peut pas
// inviter quelqu'un d'autre sur le compte auquel il appartient — sinon
// n'importe quel membre pourrait faire grandir la liste d'accès à un compte
// qui ne lui appartient pas.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
  const ownerId = userData.user.id;

  const { data: existingMembership } = await supabaseAdmin
    .from('team_members')
    .select('id')
    .eq('member_user_id', ownerId)
    .eq('status', 'accepted')
    .maybeSingle();
  if (existingMembership) {
    return NextResponse.json({ error: 'Un membre d\'équipe ne peut pas inviter d\'autres personnes.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { email, language } = body ?? {};
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }

  const { count } = await supabaseAdmin
    .from('team_members')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', ownerId);
  if ((count ?? 0) >= MAX_TEAM_MEMBERS) {
    return NextResponse.json({ error: `Limite de ${MAX_TEAM_MEMBERS} membres atteinte.` }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('company_name, language')
    .eq('id', ownerId)
    .maybeSingle();

  const normalizedEmail = email.toLowerCase().trim();

  // Un simple upsert écraserait le statut d'une invitation déjà acceptée
  // (elle repasserait à 'pending', ce qui couperait l'accès d'un membre déjà
  // actif sans le vouloir) — on ne (ré)invite donc que si aucune ligne
  // acceptée n'existe déjà pour cet email.
  const { data: existing } = await supabaseAdmin
    .from('team_members')
    .select('id, status, invite_token')
    .eq('owner_user_id', ownerId)
    .eq('invited_email', normalizedEmail)
    .maybeSingle();

  if (existing?.status === 'accepted') {
    return NextResponse.json({ error: 'Cette personne fait déjà partie de votre équipe.' }, { status: 400 });
  }

  let inviteToken = existing?.invite_token;
  if (!inviteToken) {
    const { data: created, error: insertError } = await supabaseAdmin
      .from('team_members')
      .insert({ owner_user_id: ownerId, invited_email: normalizedEmail, status: 'pending' })
      .select('invite_token')
      .single();
    if (insertError || !created) {
      console.error('[team/invite] insert failed', JSON.stringify({ ownerId, insertError }));
      return NextResponse.json({ error: 'Impossible de créer l\'invitation.' }, { status: 500 });
    }
    inviteToken = created.invite_token;
  }

  const resolvedLanguage = language === 'en' ? 'en' : language === 'fr' ? 'fr' : profile?.language === 'en' ? 'en' : 'fr';

  try {
    await sendTeamInviteEmail({
      to: email,
      inviterCompanyName: profile?.company_name || 'Churnly',
      acceptUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/team/accept?token=${inviteToken}&lang=${resolvedLanguage}`,
      language: resolvedLanguage,
    });
  } catch (err) {
    console.error('[team/invite] email send failed', JSON.stringify({ ownerId, err: err instanceof Error ? err.message : err }));
  }

  return NextResponse.json({ success: true });
}
