import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { generateAffiliateCode } from '@/lib/affiliates';

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

  const { data: affiliates, error } = await supabaseAdmin
    .from('affiliates')
    .select('id, name, email, referral_code, commission_rate, payout_method, status, notes, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Lecture échouée.' }, { status: 500 });

  // Agrégé ici plutôt que côté client : le nombre de lignes de commission
  // peut grandir indéfiniment (une par facture payée), pas la peine de tout
  // renvoyer au navigateur pour n'afficher qu'un total par affilié.
  const { data: commissions } = await supabaseAdmin
    .from('affiliate_commissions')
    .select('affiliate_id, amount_cents, status');

  const pendingByAffiliate = new Map<string, number>();
  const paidByAffiliate = new Map<string, number>();
  for (const c of commissions ?? []) {
    const map = c.status === 'paid' ? paidByAffiliate : pendingByAffiliate;
    map.set(c.affiliate_id, (map.get(c.affiliate_id) ?? 0) + c.amount_cents);
  }

  const result = (affiliates ?? []).map((a) => ({
    ...a,
    pending_cents: pendingByAffiliate.get(a.id) ?? 0,
    paid_cents: paidByAffiliate.get(a.id) ?? 0,
  }));

  return NextResponse.json({ affiliates: result });
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = await requireAdmin(req);
  if (!supabaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const commissionRate = typeof body?.commissionRate === 'number' ? body.commissionRate : 0.20;
  const payoutMethod = typeof body?.payoutMethod === 'string' ? body.payoutMethod.trim() || null : null;

  if (!name || !email) {
    return NextResponse.json({ error: 'Nom et email requis.' }, { status: 400 });
  }
  if (commissionRate <= 0 || commissionRate > 1) {
    return NextResponse.json({ error: 'Taux de commission invalide.' }, { status: 400 });
  }

  // Collision extrêmement improbable (suffixe aléatoire, voir
  // generateAffiliateCode) mais vérifiée quand même plutôt que de risquer un
  // 500 sur la contrainte unique — un affilié de plus ne doit jamais
  // échouer à cause d'un hasard malchanceux.
  let code = generateAffiliateCode(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabaseAdmin.from('affiliates').select('id').eq('referral_code', code).maybeSingle();
    if (!existing) break;
    code = generateAffiliateCode(name);
  }

  const { data, error } = await supabaseAdmin
    .from('affiliates')
    .insert({ name, email, referral_code: code, commission_rate: commissionRate, payout_method: payoutMethod })
    .select('id, name, email, referral_code, commission_rate, payout_method, status, notes, created_at')
    .single();

  if (error) return NextResponse.json({ error: 'Création échouée.' }, { status: 500 });
  return NextResponse.json({ affiliate: { ...data, pending_cents: 0, paid_cents: 0 } });
}
