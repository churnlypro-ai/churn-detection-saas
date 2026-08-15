export interface PricingResult {
  monthly: number;
  annual: number;
  annualPerMonth: number;
  tierName: string;
}

// Le prix ne dépend que du CA mensuel — demander le taux de churn à
// l'inscription n'avait pas de sens : une entreprise qui vient chez nous
// ne connaît généralement pas son propre taux de churn (c'est précisément
// le problème que Churnly résout). C'est Churnly qui le calcule, à partir
// de la vraie analyse des données une fois importées — jamais demandé en
// amont. Paliers de 2000€ de CA mensuel, sur les 5 prix Stripe existants.
export function calcPrice(revenue: number): number {
  if (revenue < 2000) return 150;
  if (revenue < 4000) return 250;
  if (revenue < 6000) return 400;
  if (revenue < 8000) return 600;
  return 800;
}

// Taux de churn moyen utilisé uniquement à titre d'illustration sur les
// pages publiques (calculateur pré-inscription) pour donner un ordre de
// grandeur de perte potentielle — jamais présenté comme le vrai chiffre
// du visiteur, qui n'est calculé qu'après sa première analyse réelle.
export const ASSUMED_CHURN_RATE = 5;

export function tierName(price: number): string {
  if (price <= 150) return 'Petit';
  if (price <= 250) return 'Petit-Moyen';
  if (price <= 400) return 'Moyen';
  if (price <= 600) return 'Gros';
  return 'Enterprise';
}

export function calcPricing(revenue: number): PricingResult {
  const monthly = calcPrice(revenue);
  const annual = monthly * 12;
  const annualPerMonth = Math.round((annual - monthly) / 12);

  return {
    monthly,
    annual,
    annualPerMonth,
    tierName: tierName(monthly),
  };
}

// Palier dédié aux comptes gérant un portefeuille de "modèles" plutôt qu'une
// base de clients classique — le prix dépend uniquement du nombre géré,
// pas du CA. Réutilise les mêmes 5 paliers Stripe existants.
export function calcManagerPrice(modelCount: number): number {
  if (modelCount <= 1) return 150;
  if (modelCount <= 3) return 250;
  if (modelCount <= 6) return 400;
  if (modelCount <= 10) return 600;
  return 800;
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}
