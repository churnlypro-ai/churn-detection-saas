import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendCallBookingReceivedEmail, sendCallBookingAdminNotifyEmail } from '@/lib/email';
import { parisDayOfWeekAndTime } from '@/lib/timezone';

const MESSAGES = {
  fr: {
    missingFields: 'Merci de remplir tous les champs requis.',
    invalidEmail: 'Adresse email invalide.',
    slotTaken: 'Ce créneau vient d\'être pris par quelqu\'un d\'autre — choisissez-en un autre.',
    failed: 'La demande a échoué — réessayez.',
  },
  en: {
    missingFields: 'Please fill in all required fields.',
    invalidEmail: 'Invalid email address.',
    slotTaken: 'This slot was just taken by someone else — please pick another one.',
    failed: 'The request failed — please try again.',
  },
} as const;

// Route publique, sans session — n'importe quel visiteur de la landing page
// peut poser une demande de call. Aucune policy RLS n'autorise cette
// insertion depuis le navigateur (voir la migration call_bookings) : c'est
// cette route, avec le client service-role, qui écrit en base.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, email, companyName, availability, slotStart, language } = body ?? {};
  const m = language === 'en' ? MESSAGES.en : MESSAGES.fr;

  if (typeof name !== 'string' || !name.trim() || typeof availability !== 'string' || !availability.trim()) {
    return NextResponse.json({ error: m.missingFields }, { status: 400 });
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: m.invalidEmail }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Re-vérifié côté serveur juste avant l'insertion : le créneau proposé par
  // /api/available-slots a pu être pris entre-temps par quelqu'un d'autre
  // (deux visiteurs sur le même créneau en même temps).
  let slotStartIso: string | null = null;
  // Le visiteur ne choisit pas de closer, seulement un horaire — retrouvé
  // ici à partir de quelle plage de closer_availability contient ce
  // créneau (voir lib/timezone.ts et la migration
  // add_closer_scoping_to_bookings), jamais envoyé par le client. Reste
  // null si aucune plage ne correspond (ancienne réservation en texte
  // libre, ou créneau à cheval sur un changement de planning) — la demande
  // reste alors visible par tous les closers plutôt que de disparaître.
  let closerEmail: string | null = null;
  if (typeof slotStart === 'string' && slotStart.trim()) {
    const parsed = new Date(slotStart);
    if (!Number.isNaN(parsed.getTime())) {
      const { data: conflict } = await supabaseAdmin
        .from('call_bookings')
        .select('id')
        .eq('slot_start', parsed.toISOString())
        .neq('status', 'canceled')
        .maybeSingle();
      if (conflict) return NextResponse.json({ error: m.slotTaken }, { status: 409 });
      slotStartIso = parsed.toISOString();

      const { dayOfWeek, time } = parisDayOfWeekAndTime(parsed);
      const { data: windows } = await supabaseAdmin
        .from('closer_availability')
        .select('closer_email, start_time, end_time')
        .eq('day_of_week', dayOfWeek);
      const match = (windows ?? []).find((w) => w.start_time <= time && time < w.end_time);
      if (match?.closer_email) closerEmail = match.closer_email;
    }
  }

  const { error } = await supabaseAdmin.from('call_bookings').insert({
    name: name.trim(),
    email: email.trim(),
    company_name: typeof companyName === 'string' && companyName.trim() ? companyName.trim() : null,
    availability: availability.trim(),
    slot_start: slotStartIso,
    closer_email: closerEmail,
  });

  if (error) {
    // Le contrôle de conflit ci-dessus (lire-puis-écrire) laisse une petite
    // fenêtre de course entre deux requêtes concurrentes sur le même
    // créneau — l'index unique partiel posé en base (voir la migration
    // call_bookings_slot_start_active_unique) est le vrai garde-fou : code
    // 23505 = violation de contrainte unique, donc quelqu'un d'autre vient
    // de prendre ce créneau entre notre vérification et notre insertion.
    if (error.code === '23505') {
      return NextResponse.json({ error: m.slotTaken }, { status: 409 });
    }
    console.error('[call-bookings] insert failed', error);
    return NextResponse.json({ error: m.failed }, { status: 500 });
  }

  // Les emails (confirmation visiteur + notification admin + notification
  // closer) ne doivent jamais faire échouer la demande elle-même si Resend a
  // un problème — la ligne est déjà en base, consultable dans /admin/calls
  // et /closer.
  const emailLanguage = language === 'en' ? 'en' : 'fr';
  // Le closer identifié ci-dessus est notifié seul plutôt que toute l'équipe
  // — sinon Kendal reçoit une notif pour un call qui tombe sur le créneau
  // d'Adam, et inversement. Repli sur tous les closers si aucun n'a pu être
  // identifié (texte libre, créneau ambigu) : mieux vaut une notif en trop
  // qu'une demande que personne ne voit passer.
  const notifyEmails = new Set([
    ...(process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean),
    ...(closerEmail ? [closerEmail] : (process.env.CLOSER_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean)),
  ]);
  await Promise.allSettled([
    sendCallBookingReceivedEmail({ to: email.trim(), name: name.trim(), language: emailLanguage }),
    ...Array.from(notifyEmails).map((notifyEmail) =>
      sendCallBookingAdminNotifyEmail({
        to: notifyEmail,
        name: name.trim(),
        email: email.trim(),
        companyName: typeof companyName === 'string' && companyName.trim() ? companyName.trim() : null,
        availability: availability.trim(),
        adminUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/closer`,
      })
    ),
  ]);

  return NextResponse.json({ success: true });
}
