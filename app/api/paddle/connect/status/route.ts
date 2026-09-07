import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resolveAccountId } from '@/lib/team';

// Même raison que app/api/gmail/status/route.ts : paddle_connection n'a
// aucune policy RLS (service-role uniquement, voir la migration
// 20260907020000), donc le client ne peut pas vérifier lui-même si une clé
// est connectée — cette route ne renvoie jamais la clé elle-même, juste un
// booléen et l'environnement.
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
    .from('paddle_connection')
    .select('environment')
    .eq('account_id', accountId)
    .maybeSingle();

  return NextResponse.json({ connected: !!data, environment: data?.environment ?? null });
}
