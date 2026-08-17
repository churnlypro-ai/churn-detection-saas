import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

function redirectToLogin(req: NextRequest, status: 'invalid' | 'error') {
  const url = new URL('/login', process.env.NEXT_PUBLIC_APP_URL || req.url);
  url.searchParams.set('team', status);
  return NextResponse.redirect(url);
}

// Le lien d'invitation email mène ici directement (voir /api/team/invite) —
// pas de formulaire d'inscription séparé à remplir pour rejoindre une
// équipe : si l'email invité n'a pas encore de compte, cette route en crée
// un (comme /api/stripe/connect/signup-callback pour l'inscription via
// Stripe), sinon elle rattache le compte existant. Dans les deux cas la
// personne atterrit connectée sur /dashboard.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const language = searchParams.get('lang') === 'en' ? 'en' : 'fr';
  if (!token) return redirectToLogin(req, 'invalid');

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('team_members')
      .select('id, owner_user_id, invited_email, status')
      .eq('invite_token', token)
      .maybeSingle();

    if (inviteError || !invite) {
      return redirectToLogin(req, 'invalid');
    }
    if (invite.status === 'accepted') {
      // Déjà acceptée (lien recliqué) : pas une erreur, on renvoie juste
      // vers la connexion normale.
      return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || req.url));
    }

    let memberUserId: string;
    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', invite.invited_email)
      .maybeSingle();

    if (existingProfile) {
      memberUserId = existingProfile.id;
    } else {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: invite.invited_email,
        email_confirm: true,
        user_metadata: { language },
      });
      if (createError || !created?.user) {
        console.error('[team/accept] createUser failed', JSON.stringify({ inviteId: invite.id, createError }));
        return redirectToLogin(req, 'error');
      }
      memberUserId = created.user.id;
    }

    const { error: updateError } = await supabaseAdmin
      .from('team_members')
      .update({ member_user_id: memberUserId, status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    if (updateError) {
      console.error('[team/accept] update failed', JSON.stringify({ inviteId: invite.id, updateError }));
      return redirectToLogin(req, 'error');
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: invite.invited_email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?team=joined` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[team/accept] generateLink failed', JSON.stringify({ inviteId: invite.id, linkError }));
      // Le rattachement a bien eu lieu, seule l'auto-connexion échoue —
      // la personne peut se connecter normalement (lien magique par email).
      return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || req.url));
    }

    return NextResponse.redirect(linkData.properties.action_link);
  } catch (err) {
    console.error('[team/accept] failed', err instanceof Error ? err.message : err);
    return redirectToLogin(req, 'error');
  }
}
