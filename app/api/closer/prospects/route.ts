import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isCloserEmail } from '@/lib/closer';

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isCloserEmail(userData?.user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // La liste est partagée entre tous les closers (comme call_bookings) : pas
  // d'assignation par personne, premier arrivé premier appelé. to_call en
  // premier pour que le prochain appel à passer soit toujours en haut.
  const { data, error } = await supabaseAdmin
    .from('cold_call_prospects')
    .select('id, name, company_name, phone, sector, status, notes, called_by, called_at, created_at')
    .order('status', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'Lecture échouée.' }, { status: 500 });

  const prospects = (data ?? []).sort((a, b) => {
    if (a.status === 'to_call' && b.status !== 'to_call') return -1;
    if (a.status !== 'to_call' && b.status === 'to_call') return 1;
    return 0;
  });

  return NextResponse.json({ prospects });
}
