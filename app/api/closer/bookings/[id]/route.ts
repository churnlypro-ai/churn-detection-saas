import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isCloserEmail } from '@/lib/closer';
import { sendCallBookingConfirmedEmail } from '@/lib/email';

async function requireCloser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!isCloserEmail(userData?.user?.email)) return null;
  return supabaseAdmin;
}

// Le closer est le seul à valider une demande de call : il fixe le créneau
// confirmé et le visiteur reçoit l'email avec la date exacte. Aucun email
// de confirmation n'est envoyé avant cette validation (voir /api/call-bookings).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAdmin = await requireCloser(req);
  if (!supabaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { confirmedSlot } = body ?? {};
  if (typeof confirmedSlot !== 'string' || !confirmedSlot.trim()) {
    return NextResponse.json({ error: 'Créneau requis.' }, { status: 400 });
  }

  const { data: booking, error: fetchError } = await supabaseAdmin
    .from('call_bookings')
    .select('name, email')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError || !booking) return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });

  const { error: updateError } = await supabaseAdmin
    .from('call_bookings')
    .update({ status: 'confirmed', confirmed_slot: confirmedSlot.trim(), confirmed_at: new Date().toISOString() })
    .eq('id', params.id);

  if (updateError) return NextResponse.json({ error: 'Confirmation échouée.' }, { status: 500 });

  try {
    await sendCallBookingConfirmedEmail({ to: booking.email, name: booking.name, confirmedSlot: confirmedSlot.trim() });
  } catch (err) {
    console.error('[closer/bookings] confirmation email failed', err);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAdmin = await requireCloser(req);
  if (!supabaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabaseAdmin.from('call_bookings').update({ status: 'canceled' }).eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Annulation échouée.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
