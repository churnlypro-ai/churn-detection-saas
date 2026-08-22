import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireOwnerId } from '@/lib/team';

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const accountId = await requireOwnerId(supabaseAdmin, token);
  if (!accountId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await supabaseAdmin.from('customer_email_connection').delete().eq('account_id', accountId);
  return NextResponse.json({ success: true });
}
