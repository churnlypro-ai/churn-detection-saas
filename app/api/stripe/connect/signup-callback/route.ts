import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  exchangeCodeForAccount,
  fetchClientsFromConnectedAccount,
  fetchConnectedAccountProfile,
  verifySignupState,
} from '@/lib/stripeConnect';
import { runChurnAnalysis } from '@/lib/analysis';

// Voir la même note dans app/api/analyze/route.ts — l'analyse initiale
// déclenchée ici peut porter sur beaucoup de clients Stripe d'un coup.
export const maxDuration = 300;

function redirectToSignup(req: NextRequest, status: 'denied' | 'error', language: 'fr' | 'en' = 'fr') {
  const url = new URL('/signup', process.env.NEXT_PUBLIC_APP_URL || req.url);
  url.searchParams.set('stripe', status);
  url.searchParams.set('lang', language);
  return NextResponse.redirect(url);
}

function redirectToLogin(req: NextRequest, status: 'account_exists', email: string) {
  const url = new URL('/login', process.env.NEXT_PUBLIC_APP_URL || req.url);
  url.searchParams.set('stripe', status);
  url.searchParams.set('email', email);
  return NextResponse.redirect(url);
}

// Stripe redirige ici après l'écran d'autorisation OAuth déclenché depuis
// /signup — aucun compte Churnly n'existe encore à ce stade, contrairement à
// /api/stripe/connect/callback (qui lie Stripe à un compte déjà existant).
// Cette route CRÉE le compte : email et nom d'entreprise viennent du compte
// Stripe qui vient d'être autorisé, et le CA / nombre de clients sont
// calculés par Churnly à partir des vrais abonnements Stripe plutôt que
// déclarés à la main — le client ne peut pas se sous-évaluer pour payer
// moins cher.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  if (searchParams.get('error')) {
    return redirectToSignup(req, 'denied');
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code || !state) {
    return redirectToSignup(req, 'error');
  }

  const verified = verifySignupState(state);
  if (!verified) {
    console.error('[stripe/connect/signup-callback] invalid or expired state');
    return redirectToSignup(req, 'error');
  }
  const { language, utm } = verified;

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const accountId = await exchangeCodeForAccount(code);
    const { email, companyName, businessDescription } = await fetchConnectedAccountProfile(accountId);

    if (!email) {
      console.error('[stripe/connect/signup-callback] connected account has no email', JSON.stringify({ accountId }));
      return redirectToSignup(req, 'error', language);
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        company_name: companyName,
        language,
        utm_source: utm?.utmSource ?? '',
        utm_medium: utm?.utmMedium ?? '',
        utm_campaign: utm?.utmCampaign ?? '',
      },
    });

    let userId: string;
    let isNewAccount: boolean;

    if (createError || !created?.user) {
      const alreadyRegistered = createError?.message?.toLowerCase().includes('already been registered') || createError?.status === 422;
      if (!alreadyRegistered) {
        console.error('[stripe/connect/signup-callback] createUser failed', JSON.stringify({ email, createError }));
        return redirectToSignup(req, 'error', language);
      }

      // Ce même bouton sert aussi à la CONNEXION (voir app/login/page.tsx) :
      // un email Stripe qui correspond déjà à un compte Churnly ne doit pas
      // échouer ni renvoyer un email de lien magique à cliquer — il doit
      // connecter directement, exactement comme le ferait Google.
      const { data: existingProfile, error: lookupError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (lookupError || !existingProfile) {
        console.error('[stripe/connect/signup-callback] existing account lookup failed', JSON.stringify({ email, lookupError }));
        return redirectToLogin(req, 'account_exists', email);
      }

      userId = existingProfile.id;
      isNewAccount = false;

      // Ne lie ce compte Stripe que s'il n'y en a pas déjà un — on ne touche
      // à aucun autre champ du profil existant (pas de resync ni d'écrasement
      // silencieux des données déjà en place à chaque connexion).
      const { data: currentProfile } = await supabaseAdmin
        .from('users')
        .select('stripe_connect_account_id')
        .eq('id', userId)
        .maybeSingle();
      if (!currentProfile?.stripe_connect_account_id) {
        await supabaseAdmin.from('users').update({ stripe_connect_account_id: accountId }).eq('id', userId);
      }
    } else {
      userId = created.user.id;
      isNewAccount = true;

      // Les vrais abonnements du compte Stripe fraîchement lié servent
      // directement à remplir le profil — jamais redemandés à la main.
      const clients = await fetchClientsFromConnectedAccount(accountId);
      const monthlyRevenue = Math.round(clients.reduce((sum, c) => sum + (Number(c.revenue_monthly) || 0), 0) * 100) / 100;

      const { error: profileError } = await supabaseAdmin
        .from('users')
        .update({
          client_count: clients.length,
          monthly_revenue: monthlyRevenue,
          industry: 'saas',
          stripe_connect_account_id: accountId,
          // Peut rester null si le compte Stripe connecté ne l'a pas renseigné
          // — dans ce cas /dashboard invite le client à le compléter (voir la
          // bannière de la section "business context" ajoutée à cette page).
          business_description: businessDescription,
        })
        .eq('id', userId);

      if (profileError) {
        console.error('[stripe/connect/signup-callback] profile update failed', JSON.stringify({ userId, profileError }));
      }

      // Analyse immédiate si des abonnements existent : le client arrive sur
      // /dashboard avec un vrai résultat déjà prêt plutôt qu'un import à
      // refaire lui-même juste après avoir créé son compte.
      if (clients.length > 0) {
        try {
          await runChurnAnalysis(supabaseAdmin, userId, clients, 'Stripe', language);
        } catch (err) {
          console.error('[stripe/connect/signup-callback] initial analysis failed', JSON.stringify({ userId, err: err instanceof Error ? err.message : err }));
        }
      }
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?stripe=${isNewAccount ? 'signup' : 'login'}` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[stripe/connect/signup-callback] generateLink failed', JSON.stringify({ userId, linkError }));
      // Le compte existe bel et bien : on envoie vers /login plutôt que de
      // perdre le client sur une erreur, il pourra s'y connecter (lien
      // magique par email classique) au lieu d'être auto-connecté.
      return redirectToLogin(req, 'account_exists', email);
    }

    return NextResponse.redirect(linkData.properties.action_link);
  } catch (err) {
    console.error('[stripe/connect/signup-callback] failed', err instanceof Error ? err.message : err);
    return redirectToSignup(req, 'error', language);
  }
}
