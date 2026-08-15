import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY || '');
  }
  return resendClient;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function generateCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

const MESSAGES = {
  fr: {
    invalidEmail: 'Email invalide.',
    wait: 'Merci de patienter avant de redemander un code.',
    dbError: 'Erreur base de données.',
    emailSendError: 'Erreur envoi email.',
    codeRequired: 'Code requis.',
    noCodeFound: 'Aucun code trouvé. Demandez un nouveau code.',
    codeExpired: 'Code expiré. Demandez un nouveau code.',
    tooManyAttempts: 'Trop de tentatives. Demandez un nouveau code.',
    incorrectCode: 'Code incorrect.',
    unknownAction: 'Action inconnue.',
    serverError: 'Erreur serveur.',
    emailTitle: 'Voici votre code de vérification',
    expiresNote: 'Ce code expire dans 10 minutes.',
    ignoreNote: "Si vous n'avez pas créé de compte, ignorez cet email.",
    emailSubject: 'Votre code de vérification Churnly',
  },
  en: {
    invalidEmail: 'Invalid email.',
    wait: 'Please wait before requesting another code.',
    dbError: 'Database error.',
    emailSendError: 'Error sending email.',
    codeRequired: 'Code required.',
    noCodeFound: 'No code found. Request a new code.',
    codeExpired: 'Code expired. Request a new code.',
    tooManyAttempts: 'Too many attempts. Request a new code.',
    incorrectCode: 'Incorrect code.',
    unknownAction: 'Unknown action.',
    serverError: 'Server error.',
    emailTitle: 'Here is your verification code',
    expiresNote: 'This code expires in 10 minutes.',
    ignoreNote: "If you didn't create an account, ignore this email.",
    emailSubject: 'Your Churnly verification code',
  },
} as const;

export async function POST(req: NextRequest) {
  try {
    const { email, action, code: submittedCode, language } = await req.json();
    const m = language === 'en' ? MESSAGES.en : MESSAGES.fr;

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: m.invalidEmail }, { status: 400 });
    }

    if (action === 'send') {
      // Le cooldown de 30s côté client (bouton "Renvoyer") est contournable
      // en appelant cette route directement — sans ce garde-fou côté
      // serveur, n'importe qui pourrait déclencher l'envoi répété de codes
      // vers une adresse email arbitraire (spam, coût Resend).
      const { data: existing } = await supabaseAdmin
        .from('email_verifications')
        .select('created_at')
        .eq('email', email)
        .maybeSingle();

      if (existing && Date.now() - new Date(existing.created_at).getTime() < 30 * 1000) {
        return NextResponse.json({ error: m.wait }, { status: 429 });
      }

      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: dbError } = await supabaseAdmin
        .from('email_verifications')
        .upsert({ email, code, expires_at: expiresAt, verified: false, attempts: 0, created_at: new Date().toISOString() }, { onConflict: 'email' });

      if (dbError) {
        console.error('[verify-email] upsert failed', dbError.message);
        return NextResponse.json({ error: m.dbError }, { status: 500 });
      }

      const html = `
        <div style="font-family: Inter, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; text-align: center; color: #1f2937;">
          <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Churnly</h1>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 32px;">${m.emailTitle}</p>
          <div style="font-size: 48px; font-weight: 700; letter-spacing: 12px; color: #d97706; margin: 24px 0;">
            ${code}
          </div>
          <p style="color: #6b7280; font-size: 13px;">${m.expiresNote}</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">${m.ignoreNote}</p>
        </div>
      `;

      const { error: emailError } = await getResend().emails.send({
        from: process.env.EMAIL_FROM || 'Churnly <noreply@yourdomain.com>',
        to: email,
        subject: m.emailSubject,
        html,
      });

      if (emailError) {
        console.error('[verify-email] resend send failed', JSON.stringify(emailError));
        return NextResponse.json({ error: m.emailSendError }, { status: 500 });
      }

      return NextResponse.json({ sent: true });
    }

    if (action === 'verify') {
      if (!submittedCode) {
        return NextResponse.json({ error: m.codeRequired }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('email_verifications')
        .select('code, expires_at, attempts')
        .eq('email', email)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: m.noCodeFound }, { status: 400 });
      }

      if (new Date(data.expires_at) < new Date()) {
        return NextResponse.json({ error: m.codeExpired }, { status: 400 });
      }

      if (data.attempts >= 5) {
        return NextResponse.json({ error: m.tooManyAttempts }, { status: 400 });
      }

      if (data.code !== submittedCode) {
        await supabaseAdmin
          .from('email_verifications')
          .update({ attempts: data.attempts + 1 })
          .eq('email', email);
        return NextResponse.json({ error: m.incorrectCode }, { status: 400 });
      }

      await supabaseAdmin
        .from('email_verifications')
        .update({ verified: true })
        .eq('email', email);

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ error: m.unknownAction }, { status: 400 });
  } catch {
    return NextResponse.json({ error: MESSAGES.fr.serverError }, { status: 500 });
  }
}
