import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resolveAccountId } from '@/lib/team';

// Une correction manuelle doit toujours l'emporter sur une détection
// automatique (voir 'auto_reimport' dans lib/analysis.ts) — c'est pour ça
// que cette route utilise un upsert qui écrase, alors que la détection
// automatique utilise ignoreDuplicates pour ne jamais écraser un
// marquage manuel déjà en place.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
  const userId = await resolveAccountId(supabaseAdmin, userData.user.id);

  const body = await req.json().catch(() => ({}));
  const { clientName, outcome } = body ?? {};

  if (!clientName || typeof clientName !== 'string') {
    return NextResponse.json({ error: 'Missing clientName' }, { status: 400 });
  }
  if (outcome !== 'churned' && outcome !== 'retained') {
    return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
  }

  // Le score au moment du marquage vient du dernier résultat d'analyse
  // connu pour ce client — c'est lui qui sera comparé au vrai résultat
  // pour calculer la précision affichée sur /dashboard.
  const { data: latestResult } = await supabaseAdmin
    .from('analysis_results')
    .select('churn_score')
    .eq('user_id', userId)
    .eq('client_name', clientName)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: upsertError } = await supabaseAdmin
    .from('client_outcomes')
    .upsert(
      {
        user_id: userId,
        client_name: clientName,
        outcome,
        churn_score_at_outcome: latestResult?.churn_score ?? null,
        source: 'manual',
        resolved_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,client_name' },
    );

  if (upsertError) {
    console.error('[mark-outcome] upsert failed', JSON.stringify({ userId, clientName, upsertError }));
    return NextResponse.json({ error: 'Could not save outcome' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
