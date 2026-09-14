import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isCloserEmail } from '@/lib/closer';

async function requireCloser(req: NextRequest): Promise<{ supabaseAdmin: ReturnType<typeof getSupabaseAdmin>; closerEmail: string } | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  const closerEmail = userData?.user?.email;
  if (!isCloserEmail(closerEmail)) return null;
  return { supabaseAdmin, closerEmail: closerEmail! };
}

// Chaque closer ne voit et ne gère que ses propres disponibilités — voir la
// migration add_closer_scoping_to_bookings. Le calcul des créneaux publics
// (/api/available-slots), lui, continue de lire toutes les lignes tous
// closers confondus : le visiteur ne choisit pas de closer, seulement un
// horaire.
export async function GET(req: NextRequest) {
  const auth = await requireCloser(req);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await auth.supabaseAdmin
    .from('closer_availability')
    .select('id, day_of_week, start_time, end_time')
    .eq('closer_email', auth.closerEmail)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) return NextResponse.json({ error: 'Lecture échouée.' }, { status: 500 });
  return NextResponse.json({ slots: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireCloser(req);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { dayOfWeek, startTime, endTime } = body ?? {};

  if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
    return NextResponse.json({ error: 'Jour invalide.' }, { status: 400 });
  }
  if (typeof startTime !== 'string' || typeof endTime !== 'string' || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return NextResponse.json({ error: 'Heures invalides.' }, { status: 400 });
  }
  if (startTime >= endTime) {
    return NextResponse.json({ error: "L'heure de fin doit être après l'heure de début." }, { status: 400 });
  }

  const { error } = await auth.supabaseAdmin.from('closer_availability').insert({
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    closer_email: auth.closerEmail,
  });

  if (error) return NextResponse.json({ error: 'Ajout échoué.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
