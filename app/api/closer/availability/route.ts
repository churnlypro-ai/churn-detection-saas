import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isCloserEmail } from '@/lib/closer';

async function requireCloser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isCloserEmail(userData?.user?.email)) return null;
  return supabaseAdmin;
}

export async function GET(req: NextRequest) {
  const supabaseAdmin = await requireCloser(req);
  if (!supabaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('closer_availability')
    .select('id, day_of_week, start_time, end_time')
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) return NextResponse.json({ error: 'Lecture échouée.' }, { status: 500 });
  return NextResponse.json({ slots: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = await requireCloser(req);
  if (!supabaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

  const { error } = await supabaseAdmin.from('closer_availability').insert({
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
  });

  if (error) return NextResponse.json({ error: 'Ajout échoué.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
