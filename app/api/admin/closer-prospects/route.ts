import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

// Vue d'ensemble pour l'admin (pas forcément un closer lui-même) : voir qui
// a été appelé ou non, par qui, avec quel résultat — sans passer par /closer
// qui est réservé aux emails de CLOSER_EMAILS.
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isAdminEmail(userData?.user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('cold_call_prospects')
    .select('id, name, company_name, phone, sector, status, notes, called_by, called_at, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Lecture échouée.' }, { status: 500 });

  const prospects = data ?? [];
  const counts = {
    total: prospects.length,
    to_call: prospects.filter((p) => p.status === 'to_call').length,
    interested: prospects.filter((p) => p.status === 'interested').length,
    callback: prospects.filter((p) => p.status === 'callback').length,
    no_answer: prospects.filter((p) => p.status === 'no_answer').length,
    not_interested: prospects.filter((p) => p.status === 'not_interested').length,
  };

  return NextResponse.json({ prospects, counts });
}
