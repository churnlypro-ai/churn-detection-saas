import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Account creation is only allowed to go through this route, never
// supabase.auth.signUp() directly from the browser — otherwise anyone
// could create a Churnly account under an email address they don't own
// by skipping the 4-digit code step entirely (it was never checked
// server-side before this route existed). This route is the one place
// that actually enforces it: no verified, unexpired code for this email,
// no account.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password, companyName, clientCount, monthlyRevenue, industry } = body ?? {};

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

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
      { error: 'Email non vérifié. Recommencez la vérification par code.' },
      { status: 400 },
    );
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { company_name: companyName ?? '' },
  });

  if (createError || !created?.user) {
    return NextResponse.json(
      { error: createError?.message ?? 'Impossible de créer le compte.' },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      client_count: clientCount ?? null,
      monthly_revenue: monthlyRevenue ?? null,
      industry: industry ?? null,
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
