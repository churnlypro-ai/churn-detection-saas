import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { addDaysToDateString, dayOfWeekOfDateString, parisWallTimeToUtc, todayParisDateString } from '@/lib/timezone';

// Route publique — le formulaire de réservation de call de l'accueil ne
// propose plus de date/heure libre, seulement les créneaux réellement
// ouverts chez le closer (voir /closer/availability), moins ceux déjà pris.
const SLOT_MINUTES = 30;
const DAYS_AHEAD = 14;

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();

  const [{ data: availability }, { data: booked }] = await Promise.all([
    supabaseAdmin.from('closer_availability').select('day_of_week, start_time, end_time'),
    supabaseAdmin.from('call_bookings').select('slot_start').not('slot_start', 'is', null).neq('status', 'canceled'),
  ]);

  const bookedTimestamps = new Set((booked ?? []).map((b) => new Date(b.slot_start as string).getTime()));
  const now = Date.now();

  const slots: string[] = [];
  let cursor = todayParisDateString();

  for (let d = 0; d < DAYS_AHEAD; d++) {
    const dow = dayOfWeekOfDateString(cursor);
    const dayWindows = (availability ?? []).filter((a) => a.day_of_week === dow);

    for (const window of dayWindows) {
      const startMin = timeStrToMinutes(window.start_time);
      const endMin = timeStrToMinutes(window.end_time);
      for (let m = startMin; m + SLOT_MINUTES <= endMin; m += SLOT_MINUTES) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        const slotUtc = parisWallTimeToUtc(cursor, `${hh}:${mm}`);
        if (slotUtc.getTime() <= now) continue;
        if (bookedTimestamps.has(slotUtc.getTime())) continue;
        slots.push(slotUtc.toISOString());
      }
    }

    cursor = addDaysToDateString(cursor, 1);
  }

  return NextResponse.json({ slots, timezone: 'Europe/Paris' });
}
