import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const MESSAGES = {
  fr: {
    missingCredentials: 'Email et mot de passe requis.',
    passwordTooShort: 'Le mot de passe doit contenir au moins 8 caractères.',
    businessDescriptionRequired: 'Décrivez votre activité en quelques mots.',
    emailNotVerified: 'Email non vérifié. Recommencez la vérification par code.',
    cannotCreateAccount: 'Impossible de créer le compte.',
  },
  en: {
    missingCredentials: 'Email and password required.',
    passwordTooShort: 'Password must be at least 8 characters.',
    businessDescriptionRequired: 'Describe your business in a few words.',
    emailNotVerified: 'Email not verified. Restart the code verification.',
    cannotCreateAccount: 'Could not create the account.',
  },
} as const;

// Account creation is only allowed to go through this route, never
// supabase.auth.signUp() directly from the browser — otherwise anyone
// could create a Churnly account under an email address they don't own
// by skipping the 4-digit code step entirely (it was never checked
// server-side before this route existed). This route is the one place
// that actually enforces it: no verified, unexpired code for this email,
// no account.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password, companyName, businessDescription, clientCount, monthlyRevenue, industry, language, referredBy } = body ?? {};
  const m = language === 'en' ? MESSAGES.en : MESSAGES.fr;

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return NextResponse.json({ error: m.missingCredentials }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: m.passwordTooShort }, { status: 400 });
  }
  // Revérifié côté serveur — le garde-fou client (app/signup/page.tsx) est
  // contournable en appelant cette route directement, et sans une vraie
  // description l'analyse IA retombe sur des seuils génériques (voir
  // businessContextInstruction dans lib/claude.ts).
  if (typeof businessDescription !== 'string' || businessDescription.trim().length < 15) {
    return NextResponse.json({ error: m.businessDescriptionRequired }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Un code de parrainage inventé/invalide ne doit jamais faire échouer
  // l'inscription — juste être ignoré silencieusement plutôt que stocké
  // tel quel (voir handle_new_user, qui lit raw_user_meta_data.referred_by).
  let validatedReferredBy: string | null = null;
  if (typeof referredBy === 'string' && referredBy.trim()) {
    const { data: referrer } = await supabaseAdmin
      .from('users')
      .select('referral_code')
      .eq('referral_code', referredBy.trim())
      .maybeSingle();
    if (referrer) validatedReferredBy = referrer.referral_code;
  }

  const { data: verification, error: verificationError } = await supabaseAdmin
    .from('email_verifications')
    .select('verified, expires_at')
    .eq('email', email)
    .maybeSingle();

  if (
    verificationError ||
    !verification?.verified ||
    new Date(verification.expires_at) < new Date()
  ) {
    return NextResponse.json(
      { error: m.emailNotVerified },
      { status: 400 },
    );
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { company_name: companyName ?? '', language: language === 'en' ? 'en' : 'fr', referred_by: validatedReferredBy ?? '' },
  });

  if (createError || !created?.user) {
    return NextResponse.json(
      { error: createError?.message ?? m.cannotCreateAccount },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      client_count: clientCount ?? null,
      monthly_revenue: monthlyRevenue ?? null,
      industry: industry ?? null,
      business_description: businessDescription.trim(),
      // churn_rate n'est jamais fourni à l'inscription — Churnly le calcule
      // lui-même à partir de la première analyse réelle (voir /api/analyze).
    })
    .eq('id', created.user.id);

  // Le code n'a plus de raison d'exister une fois consommé — évite qu'il
  // serve à un second appel à cette route pour le même email.
  await supabaseAdmin.from('email_verifications').delete().eq('email', email);

  if (updateError) {
    console.error('[complete-signup] profile update failed', JSON.stringify({ userId: created.user.id, updateError }));
  }

  return NextResponse.json({ success: true });
}
