import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isCloserEmail } from '@/lib/closer';

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  const closerEmail = userData?.user?.email;
  if (!isCloserEmail(closerEmail)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Chaque closer ne voit que son propre lot (voir assigned_to, migration
  // 20260922000000) — l'admin répartit la file depuis /admin/closer-prospects
  // pour que deux closers n'appellent jamais le même prospect le même jour.
  // La garde status='to_call' dans le PATCH de /api/closer/prospects/[id]
  // reste en place par sécurité, mais ne devrait plus jamais se déclencher
  // entre deux closers différents puisqu'ils ne partagent plus de lignes.
  // to_call en premier pour que le prochain appel à passer soit toujours en
  // haut.
  // assigned_to est toujours stocké en minuscules (voir POST /assign et le
  // PATCH admin) — comparé ici en minuscules aussi pour ne pas dépendre de
  // la casse exacte renvoyée par Supabase Auth pour cet email.
  const { data, error } = await supabaseAdmin
    .from('cold_call_prospects')
    .select('id, name, company_name, phone, sector, status, notes, called_by, called_at, created_at')
    .eq('assigned_to', closerEmail?.toLowerCase())
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
