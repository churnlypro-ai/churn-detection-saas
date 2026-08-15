import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { calcPrice, tierName } from '@/lib/pricing';

interface RegistryResult {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  etat_administratif?: string;
  siege?: { siret?: string };
}

// Best-effort lookup against the free, public French company registry.
// Never throws to the caller — a company not being found (sole proprietors,
// very new companies, non-French businesses) is not treated as suspicious.
async function lookupCompany(companyName: string): Promise<{
  verified: boolean;
  legalName: string | null;
  siret: string | null;
}> {
  try {
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(companyName)}&per_page=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { verified: false, legalName: null, siret: null };

    const data = await res.json();
    const result: RegistryResult | undefined = Array.isArray(data?.results) ? data.results[0] : undefined;
    if (!result) return { verified: false, legalName: null, siret: null };

    const isActive = !result.etat_administratif || result.etat_administratif === 'A';
    return {
      verified: isActive,
      legalName: result.nom_complet ?? result.nom_raison_sociale ?? null,
      siret: result.siege?.siret ?? null,
    };
  } catch (err) {
    console.error('[verify-company] registry lookup failed', err instanceof Error ? err.message : err);
    return { verified: false, legalName: null, siret: null };
  }
}

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

  const body = await req.json().catch(() => ({}));
  const { companyName, monthlyRevenue } = body ?? {};

  const tier = calcPrice(Number(monthlyRevenue) || 0);
  const leadTier = tierName(tier);

  let registry = { verified: false, legalName: null as string | null, siret: null as string | null };
  if (companyName && typeof companyName === 'string' && companyName.trim().length >= 2) {
    registry = await lookupCompany(companyName.trim());
  }

  await supabaseAdmin
    .from('users')
    .update({
      lead_tier: leadTier,
      company_verified: registry.verified,
      company_legal_name: registry.legalName,
      company_siret: registry.siret,
    })
    .eq('id', userData.user.id);

  return NextResponse.json({ leadTier, ...registry });
}
