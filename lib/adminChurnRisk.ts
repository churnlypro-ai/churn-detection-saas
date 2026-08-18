// Score de risque des comptes CHURNLY eux-mêmes (pas de leurs clients à eux)
// — calculé avec des règles simples sur des signaux déjà en base (statut
// Stripe, activité récente) plutôt qu'un appel Claude par compte : ce
// tableau de bord admin doit rester instantané et gratuit à charger, pas
// dépendre d'un appel API payant à chaque ouverture.
export interface AdminRiskInput {
  subscriptionStatus: string;
  createdAt: string;
  lastActivityAt: string | null;
}

export type AdminRiskLevel = 'low' | 'medium' | 'high';

export interface AdminRiskResult {
  score: number;
  level: AdminRiskLevel;
  reason: string;
}

function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  return Math.floor((now - new Date(iso).getTime()) / 86_400_000);
}

export function computeAdminChurnRisk(input: AdminRiskInput, now: number = Date.now()): AdminRiskResult {
  const activityDays = daysSince(input.lastActivityAt, now);
  const signupDays = daysSince(input.createdAt, now) ?? 0;

  if (input.subscriptionStatus === 'canceled') {
    return { score: 100, level: 'high', reason: 'Abonnement déjà annulé' };
  }
  if (input.subscriptionStatus === 'past_due') {
    return { score: 90, level: 'high', reason: 'Paiement en échec (past_due)' };
  }

  if (input.subscriptionStatus === 'trialing') {
    if (activityDays === null && signupDays >= 2) {
      return { score: 80, level: 'high', reason: 'Essai bientôt terminé, aucune donnée importée' };
    }
    if (activityDays === null) {
      return { score: 40, level: 'medium', reason: 'Aucune donnée importée pour l\'instant' };
    }
    return { score: 15, level: 'low', reason: 'Essai en cours, compte actif' };
  }

  // subscription_status === 'active'
  if (activityDays === null) {
    return { score: 70, level: 'high', reason: 'Payant mais n\'a jamais importé de données' };
  }
  if (activityDays > 30) {
    return { score: 75, level: 'high', reason: `${activityDays} jours sans activité` };
  }
  if (activityDays > 14) {
    return { score: 45, level: 'medium', reason: `${activityDays} jours sans activité` };
  }
  return { score: 10, level: 'low', reason: 'Actif récemment' };
}
