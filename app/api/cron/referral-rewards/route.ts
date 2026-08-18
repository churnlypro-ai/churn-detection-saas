import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { applyMonthlyReferralRewards } from '@/lib/referralRewards';

// Tourne le 1er de chaque mois (voir vercel.json) : récompense les
// parrainages du mois qui vient de se terminer. 2 filleuls devenus payants
// -> 50% de réduction sur la prochaine facture, 3+ -> gratuite. Décision
// produit du 18/08 — voir lib/referralRewards.ts pour le détail du calcul.
export const maxDuration = 60;

async function handleCron(req: NextRequest) {
  const providedSecret =
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    req.headers.get('x-cron-secret') ??
    new URL(req.url).searchParams.get('secret');

  if (!process.env.CRON_SECRET || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const results = await applyMonthlyReferralRewards(supabaseAdmin);

  return NextResponse.json({ results });
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
