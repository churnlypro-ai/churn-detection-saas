import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isCloserEmail } from '@/lib/closer';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  const closerEmail = userData?.user?.email;
  if (!isCloserEmail(closerEmail)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Sans ce filtre, un closer pourrait supprimer les disponibilités d'un
  // autre closer en connaissant/rejouant son id (voir la migration
  // add_closer_scoping_to_bookings).
  const { data, error } = await supabaseAdmin
    .from('closer_availability')
    .delete()
    .eq('id', params.id)
    .eq('closer_email', closerEmail)
    .select('id');
  if (error) return NextResponse.json({ error: 'Suppression échouée.' }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: 'Ce créneau ne vous appartient pas.' }, { status: 403 });
  return NextResponse.json({ success: true });
}
