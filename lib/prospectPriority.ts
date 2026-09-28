// Classe un prospect cold-call par pertinence pour Churnly, à partir de son
// secteur — sert à trier /closer pour que les meilleurs profils remontent en
// haut, sans jamais masquer personne (juste un ordre d'appel suggéré).
// Priorité basée sur le retour de Kevin (conseiller) : les entreprises par
// abonnement tenues par des non-développeurs, déjà exposées au churn, sont
// des prospects bien plus faciles à convaincre que des SaaS vendus à des
// fondateurs techniques ("je le code moi-même") — voir la conversation du
// 21 septembre.
const HIGH_PRIORITY = /fitness|sport|gym|crossfit|salle de sport|coiffure|beaut[ée]|restaurant|restauration|agence (immobili|de voyage|[ée]v[ée]nementiel)|proptech|immobili|logement|box\b|coworking|artisan|btp|garage|auto-[ée]cole|cr[eè]che|location de mat[ée]riel|pressing|photographe|taxi|vtc|v[ée]t[ée]rinaire|animalerie|e-?commerce|retail|coaching/i;

const LOW_PRIORITY = /cybers[ée]curit|s[ée]curit[ée]|s[ée]curis|ia conversationnelle|callbot|t[ée]l[ée]phonie ia|crm|sales|marketing automation|prospection|commissions|d[ée]veloppeur|\bapi\b|infra|no-?code|logiciel technique/i;

// Plus le nombre est haut, plus le prospect remonte en haut de la liste.
export function getSectorPriority(sector: string | null | undefined): number {
  if (!sector) return 1; // secteur inconnu — priorité moyenne, ni pénalisé ni favorisé
  if (HIGH_PRIORITY.test(sector)) return 2;
  if (LOW_PRIORITY.test(sector)) return 0;
  return 1;
}
