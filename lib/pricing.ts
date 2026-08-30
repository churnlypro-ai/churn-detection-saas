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
// amont. Paliers de 5000€ de CA mensuel jusqu'à 20 000€, puis deux paliers
// Enterprise au-delà (20-50k et 50k+) — toujours affiché automatiquement,
// jamais de devis/démo manuelle : un gros compte doit rester self-serve
// comme les autres, sinon on retombe dans un tunnel de vente qu'on a
// justement voulu éviter partout ailleurs sur le produit. Le prix d'entrée
// doit rester nettement inférieur à ce qu'une réduction de churn peut
// réalistement faire économiser à ce niveau de CA.
export function calcPrice(revenue: number): number {
  if (revenue < 5000) return 150;
  if (revenue < 10000) return 250;
  if (revenue < 15000) return 400;
  if (revenue < 20000) return 600;
  if (revenue < 50000) return 800;
  if (revenue < 200000) return 1200;
  return 2500;
}

// Taux de churn moyen utilisé uniquement à titre d'illustration sur les
// pages publiques (calculateur pré-inscription) pour donner un ordre de
// grandeur de perte potentielle — jamais présenté comme le vrai chiffre
// du visiteur, qui n'est calculé qu'après sa première analyse réelle.
export const ASSUMED_CHURN_RATE = 5;

// Un nom distinct par palier de prix — "Enterprise" collait auparavant aux
// trois derniers paliers (800€/1200€/2500€) malgré des prix très différents,
// donnant l'impression que rien ne change en montant de palier.
export function tierName(price: number): string {
  if (price <= 150) return 'Starter';
  if (price <= 250) return 'Croissance';
  if (price <= 400) return 'Scale';
  if (price <= 600) return 'Avancé';
  if (price <= 800) return 'Business';
  if (price <= 1200) return 'Grand compte';
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
