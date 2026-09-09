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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAdmin = await requireAdmin(req);
  if (!supabaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { status } = body ?? {};
  if (status !== 'active' && status !== 'paused') {
    return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('affiliates').update({ status }).eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Mise à jour échouée.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
