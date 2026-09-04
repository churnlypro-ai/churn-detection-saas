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
// amont.
//
// Échelle continue plutôt que quelques gros paliers espacés : 60€ sous
// 2 000€ de CA, puis +50€ tous les 2 000€ de CA supplémentaires, sans
// plafond — un compte à 1M€ de CA paie le même calcul qu'un compte à
// 10 000€, jamais un tarif négocié à part. Le prix n'est donc plus une
// poignée de valeurs fixes mais un nombre parmi des dizaines possibles ;
// voir lib/stripe.ts (priceDataForAmount) pour comment Stripe facture un
// montant calculé à la volée sans qu'un Price existe pour chacun d'entre
// eux à l'avance. Toujours affiché automatiquement, jamais de devis/démo
// manuelle : un gros compte doit rester self-serve comme les autres,
// sinon on retombe dans un tunnel de vente qu'on a justement voulu éviter
// partout ailleurs sur le produit.
export function calcPrice(revenue: number): number {
  if (revenue < 2000) return 60;
  return 100 + 50 * Math.floor((revenue - 2000) / 2000);
}

// Facturation à la performance : un socle mensuel fixe (pour ne pas rendre
// Churnly gratuit à quiconque n'a simplement rien à récupérer un mois donné)
// + un % du revenu concrètement récupéré par Churnly (ex: paiement en échec
// relancé avec succès), les deux facturés ensemble une fois par mois — voir
// lib/performanceBilling.ts. Alternative optionnelle au palier basé sur le
// CA (calcPrice ci-dessus), jamais le défaut.
export const PERFORMANCE_BASE_FEE = 50;
export const PERFORMANCE_FEE_RATE = 0.25;

// Taux de churn moyen utilisé uniquement à titre d'illustration sur les
// pages publiques (calculateur pré-inscription) pour donner un ordre de
// grandeur de perte potentielle — jamais présenté comme le vrai chiffre
// du visiteur, qui n'est calculé qu'après sa première analyse réelle.
export const ASSUMED_CHURN_RATE = 5;

// Purement cosmétique : calcPrice renvoie désormais un point parmi des
// dizaines de valeurs possibles sur une échelle continue, plus une poignée
// de paliers fixes — ce nom ne sert qu'à regrouper un prix précis sous une
// étiquette lisible (dashboard, email de facture, page tarifs), jamais à
// délimiter un vrai palier tarifaire.
export function tierName(price: number): string {
  if (price <= 60) return 'Starter';
  if (price <= 150) return 'Croissance';
  if (price <= 300) return 'Scale';
  if (price <= 600) return 'Avancé';
  if (price <= 1200) return 'Business';
  if (price <= 2500) return 'Grand compte';
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
// pas du CA. Reste par paliers fixes (pas d'échelle continue comme
// calcPrice) : le nombre de modèles gérés est un entier petit et discret,
// une échelle par tranche de 2 n'aurait pas plus de sens business qu'une
// grille à 5 paliers.
export function calcManagerPrice(modelCount: number): number {
  if (modelCount <= 1) return 60;
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
