import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendCallBookingReceivedEmail, sendCallBookingAdminNotifyEmail } from '@/lib/email';

const MESSAGES = {
  fr: {
    missingFields: 'Merci de remplir tous les champs requis.',
    invalidEmail: 'Adresse email invalide.',
    failed: 'La demande a échoué — réessayez.',
  },
  en: {
    missingFields: 'Please fill in all required fields.',
    invalidEmail: 'Invalid email address.',
    failed: 'The request failed — please try again.',
  },
} as const;

// Route publique, sans session — n'importe quel visiteur de la landing page
// peut poser une demande de call. Aucune policy RLS n'autorise cette
// insertion depuis le navigateur (voir la migration call_bookings) : c'est
// cette route, avec le client service-role, qui écrit en base.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, email, companyName, availability, language } = body ?? {};
  const m = language === 'en' ? MESSAGES.en : MESSAGES.fr;

  if (typeof name !== 'string' || !name.trim() || typeof availability !== 'string' || !availability.trim()) {
    return NextResponse.json({ error: m.missingFields }, { status: 400 });
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: m.invalidEmail }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from('call_bookings').insert({
    name: name.trim(),
    email: email.trim(),
    company_name: typeof companyName === 'string' && companyName.trim() ? companyName.trim() : null,
    availability: availability.trim(),
  });

  if (error) {
    console.error('[call-bookings] insert failed', error);
    return NextResponse.json({ error: m.failed }, { status: 500 });
  }

  // Les deux emails (confirmation visiteur + notification admin) ne doivent
  // jamais faire échouer la demande elle-même si Resend a un problème — la
  // ligne est déjà en base, l'équipe peut toujours la voir dans /admin/calls.
  const emailLanguage = language === 'en' ? 'en' : 'fr';
  await Promise.allSettled([
    sendCallBookingReceivedEmail({ to: email.trim(), name: name.trim(), language: emailLanguage }),
    ...(process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim()).filter(Boolean).map((adminEmail) =>
          sendCallBookingAdminNotifyEmail({
            to: adminEmail,
            name: name.trim(),
            email: email.trim(),
            companyName: typeof companyName === 'string' && companyName.trim() ? companyName.trim() : null,
            availability: availability.trim(),
            adminUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/admin/calls`,
          })
        )
      : []),
  ]);

  return NextResponse.json({ success: true });
}
