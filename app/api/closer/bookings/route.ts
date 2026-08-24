import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isCloserEmail } from '@/lib/closer';

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isCloserEmail(userData?.user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('call_bookings')
    .select('id, name, email, company_name, availability, status, confirmed_slot, slot_start, created_at')
    .neq('status', 'canceled')
    .order('slot_start', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Lecture échouée.' }, { status: 500 });
  return NextResponse.json({ bookings: data ?? [] });
}
