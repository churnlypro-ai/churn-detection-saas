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

export async function POST(req: NextRequest) {
  try {
    const { email, action, code: submittedCode } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email requis.' }, { status: 400 });
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
        return NextResponse.json({ error: 'Merci de patienter avant de redemander un code.' }, { status: 429 });
      }

      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: dbError } = await supabaseAdmin
        .from('email_verifications')
        .upsert({ email, code, expires_at: expiresAt, verified: false, attempts: 0, created_at: new Date().toISOString() }, { onConflict: 'email' });

      if (dbError) {
        console.error('[verify-email] upsert failed', dbError.message);
        return NextResponse.json({ error: 'Erreur base de données.' }, { status: 500 });
      }

      const html = `
        <div style="font-family: Inter, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; text-align: center; color: #1f2937;">
          <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Churnly</h1>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 32px;">Voici votre code de vérification</p>
          <div style="font-size: 48px; font-weight: 700; letter-spacing: 12px; color: #d97706; margin: 24px 0;">
            ${code}
          </div>
          <p style="color: #6b7280; font-size: 13px;">Ce code expire dans 10 minutes.</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">Si vous n'avez pas créé de compte, ignorez cet email.</p>
        </div>
      `;

      const { error: emailError } = await getResend().emails.send({
        from: process.env.EMAIL_FROM || 'Churnly <noreply@yourdomain.com>',
        to: email,
        subject: 'Votre code de vérification Churnly',
        html,
      });

      if (emailError) {
        console.error('[verify-email] resend send failed', JSON.stringify(emailError));
        return NextResponse.json({ error: 'Erreur envoi email.' }, { status: 500 });
      }

      return NextResponse.json({ sent: true });
    }

    if (action === 'verify') {
      if (!submittedCode) {
        return NextResponse.json({ error: 'Code requis.' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('email_verifications')
        .select('code, expires_at, attempts')
        .eq('email', email)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Aucun code trouvé. Demandez un nouveau code.' }, { status: 400 });
      }

      if (new Date(data.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Code expiré. Demandez un nouveau code.' }, { status: 400 });
      }

      if (data.attempts >= 5) {
        return NextResponse.json({ error: 'Trop de tentatives. Demandez un nouveau code.' }, { status: 400 });
      }

      if (data.code !== submittedCode) {
        await supabaseAdmin
          .from('email_verifications')
          .update({ attempts: data.attempts + 1 })
          .eq('email', email);
        return NextResponse.json({ error: 'Code incorrect.' }, { status: 400 });
      }

      await supabaseAdmin
        .from('email_verifications')
        .update({ verified: true })
        .eq('email', email);

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
