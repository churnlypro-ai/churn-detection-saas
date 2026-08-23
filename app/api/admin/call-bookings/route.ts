import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return null;
  return supabaseAdmin;
}

export async function GET(req: NextRequest) {
  const supabaseAdmin = await requireAdmin(req);
  if (!supabaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('call_bookings')
    .select('id, name, email, company_name, availability, status, confirmed_slot, confirmed_at, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Lecture échouée.' }, { status: 500 });
  return NextResponse.json({ bookings: data ?? [] });
}
