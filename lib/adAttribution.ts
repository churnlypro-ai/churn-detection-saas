export interface AdSource {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

const STORAGE_KEY = 'churnly_ad_source';

// Appelé une fois par page (voir components/AdSourceCapture.tsx) : une
// visite qui arrive avec un utm_source remplace la valeur déjà stockée —
// c'est le dernier clic publicitaire avant l'inscription qui doit compter,
// pas la toute première visite historique du navigateur.
export function captureAdSourceFromUrl(search: string): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(search);
  const utmSource = params.get('utm_source');
  if (!utmSource) return;

  const value: AdSource = {
    utmSource,
    utmMedium: params.get('utm_medium'),
    utmCampaign: params.get('utm_campaign'),
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
