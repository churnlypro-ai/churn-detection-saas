import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resolveAccountId } from '@/lib/team';

// Voir app/api/paddle/connect/status/route.ts — même raison (aucune
// policy RLS sur lemonsqueezy_connection).
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
  const accountId = await resolveAccountId(supabaseAdmin, userData.user.id);

  const { data } = await supabaseAdmin
    .from('lemonsqueezy_connection')
    .select('account_id')
    .eq('account_id', accountId)
    .maybeSingle();

  return NextResponse.json({ connected: !!data });
}
