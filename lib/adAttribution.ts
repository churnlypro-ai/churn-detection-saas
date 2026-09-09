export interface AdSource {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  affiliateCode: string | null;
}

const STORAGE_KEY = 'churnly_ad_source';

// Appelé une fois par page (voir components/AdSourceCapture.tsx) : une
// visite qui arrive avec un utm_source remplace la valeur déjà stockée —
// c'est le dernier clic publicitaire avant l'inscription qui doit compter,
// pas la toute première visite historique du navigateur.
//
// Le code affilié (?aff=...) suit la même logique mais indépendamment de
// utm_source : un lien d'affiliation ne porte pas forcément de paramètres
// utm, et pointe généralement vers la page d'accueil plutôt que directement
// vers /signup — sans cette capture persistante, le code serait perdu dès
// que le visiteur clique sur "Commencer gratuitement" (voir la même
// limitation, non corrigée ici, du paramètre ?ref= du parrainage client
// dans app/signup/page.tsx, lu uniquement depuis l'URL immédiate).
export function captureAdSourceFromUrl(search: string): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(search);
  const utmSource = params.get('utm_source');
  const affiliateCode = params.get('aff');
  if (!utmSource && !affiliateCode) return;

  const existing = readStoredAdSource();
  const value: AdSource = {
    utmSource: utmSource ?? existing?.utmSource ?? null,
    utmMedium: utmSource ? params.get('utm_medium') : existing?.utmMedium ?? null,
    utmCampaign: utmSource ? params.get('utm_campaign') : existing?.utmCampaign ?? null,
    affiliateCode: affiliateCode ?? existing?.affiliateCode ?? null,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Stockage indisponible (navigation privée, quota...) — pas bloquant
    // pour l'inscription elle-même, juste une attribution en moins.
  }
}

export function readStoredAdSource(): AdSource | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdSource;
  } catch {
    return null;
  }
}
