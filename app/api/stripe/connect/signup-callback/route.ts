import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  exchangeCodeForAccount,
  fetchClientsFromConnectedAccount,
  fetchConnectedAccountProfile,
  verifySignupState,
} from '@/lib/stripeConnect';
import { runChurnAnalysis } from '@/lib/analysis';

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
  const { language } = verified;

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const accountId = await exchangeCodeForAccount(code);
    const { email, companyName } = await fetchConnectedAccountProfile(accountId);

    if (!email) {
      console.error('[stripe/connect/signup-callback] connected account has no email', JSON.stringify({ accountId }));
      return redirectToSignup(req, 'error', language);
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { company_name: companyName, language },
    });

    if (createError || !created?.user) {
      // Email déjà utilisé par un compte Churnly existant : on ne peut pas
      // créer de doublon. On envoie vers /login plutôt que d'échouer
      // silencieusement — ce client peut lier Stripe depuis /settings une
      // fois connecté.
      if (createError?.message?.toLowerCase().includes('already been registered') || createError?.status === 422) {
        return redirectToLogin(req, 'account_exists', email);
      }
      console.error('[stripe/connect/signup-callback] createUser failed', JSON.stringify({ email, createError }));
      return redirectToSignup(req, 'error', language);
    }

    const userId = created.user.id;

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

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?stripe=signup` },
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
