// Génère une piste d'approche pour un prospect à partir de son secteur —
// jamais un fait vérifié sur l'entreprise elle-même (on ne connaît ni son
// CA, ni son taux de churn réel), juste une heuristique de vente basée sur
// la catégorie d'activité, à charge pour le closer d'ajuster à l'oral.
// Volontairement statique (pas d'appel IA) : doit s'afficher instantanément
// pendant un appel, pas après un aller-retour réseau.
export interface ApproachHint {
  profil: string;
  angle: string;
  accroche: string;
  question: string;
}

interface Rule {
  match: RegExp;
  hint: ApproachHint;
}

const RULES: Rule[] = [
  {
    match: /crm|sales|marketing automation|prospection|commissions/i,
    hint: {
      profil: 'Éditeur d\'un outil commercial/marketing — connaît déjà la valeur de la rétention client, cible facile à convaincre sur le fond.',
      angle: 'Aller droit au ROI : ils vendent eux-mêmes de la performance commerciale, donc parler chiffres (5-7x moins cher de retenir que d\'acquérir) fonctionne mieux qu\'un discours produit.',
      accroche: 'Vous aidez vos clients à mieux vendre — nous, on aide des boîtes comme la vôtre à ne pas perdre les clients déjà acquis.',
      question: 'Aujourd\'hui, comment vous repérez un client qui part avant qu\'il annule ?',
    },
  },
  {
    match: /logistique|field service|erp|interventions|production|tourn[ée]es/i,
    hint: {
      profil: 'Outil opérationnel/terrain — audience pragmatique, moins sensible au discours "IA", veut du concret et rapide.',
      angle: 'Éviter le jargon IA, aller directement au résultat opérationnel : un scan gratuit, un score par client, sans rien changer à leur outil actuel.',
      accroche: 'On ne remplace rien de votre outil actuel, on ajoute juste un radar sur vos clients à risque de partir.',
      question: 'Quand un client part, vous le savez avant ou après qu\'il ait annulé ?',
    },
  },
  {
    match: /proptech|immobili|logement/i,
    hint: {
      profil: 'PropTech par abonnement — churn souvent élevé et peu suivi car l\'attention va à l\'acquisition de biens/mandats.',
      angle: 'Souligner que le churn y est structurellement sous-surveillé : bon terrain pour un premier scan gratuit qui "ouvre les yeux".',
      accroche: 'Sur ce type de plateforme, le churn est souvent plus élevé que ce qu\'on pense — un scan gratuit vous donne le vrai chiffre en 2 minutes.',
      question: 'Vous avez une idée précise de combien de clients vous perdez chaque mois, ou c\'est plutôt une impression ?',
    },
  },
  {
    match: /cybersécurit|sécurité|s[eé]curis/i,
    hint: {
      profil: 'Éditeur sécurité/cybersécurité — audience technique et exigeante sur la confidentialité des données.',
      angle: 'Anticiper l\'objection données avant qu\'elle arrive : insister d\'emblée sur "aucune donnée personnelle finale stockée, suppression en un clic".',
      accroche: 'Avant même de parler churn : on ne stocke aucune donnée personnelle de vos clients finaux, et tout est supprimable en un clic.',
      question: 'Qu\'est-ce qui vous ferait hésiter à tester un outil qui analyse votre fichier clients ?',
    },
  },
  {
    match: /ia conversationnelle|callbot|t[ée]l[ée]phonie|call tracking/i,
    hint: {
      profil: 'Déjà un éditeur IA/téléphonie — comprend vite la mécanique, pas besoin de pédagogie sur l\'IA elle-même.',
      angle: 'Aller vite sur la différenciation : la méthode (score par client, groupe témoin pour prouver l\'effet) plutôt que réexpliquer ce qu\'est l\'IA.',
      accroche: 'Vous connaissez déjà l\'IA appliquée au client — nous l\'appliquons spécifiquement à la prédiction de churn, avec preuve causale, pas juste une corrélation.',
      question: 'Est-ce que vous mesurez aujourd\'hui l\'impact réel de vos actions de rétention, ou juste "on a relancé, il est resté" ?',
    },
  },
  {
    match: /fintech|comptab|ged/i,
    hint: {
      profil: 'Fintech / comptabilité — audience sensible à la rigueur méthodologique et à la fiabilité des chiffres.',
      angle: 'Mettre en avant la méthode elle-même (groupe témoin à 3%, mesure causale) plutôt que le produit — ce public est convaincu par la rigueur, pas le pitch.',
      accroche: 'On ne se contente pas de dire "ça marche" : on mesure l\'effet réel avec un groupe témoin, comme un vrai test contrôlé.',
      question: 'Comment vous évaluez aujourd\'hui si une action de rétention a vraiment eu un effet, ou si le client serait resté de toute façon ?',
    },
  },
  {
    match: /signature électronique|abonnement/i,
    hint: {
      profil: 'Pur SaaS par abonnement — chaque client parti est une perte de revenu récurrent directe et facile à chiffrer.',
      angle: 'Chiffrer immédiatement : X€ de MRR perdu = X€/mois qui repart avec le client. Le lien churn → revenu est immédiat pour eux.',
      accroche: 'Chaque client qui part, c\'est du revenu récurrent qui disparaît direct de votre MRR — on vous aide à le voir venir.',
      question: 'Sur votre MRR actuel, vous perdez à peu près combien par mois en clients qui ne renouvellent pas ?',
    },
  },
];

const DEFAULT_HINT: ApproachHint = {
  profil: 'Éditeur SaaS / abonnement — profil standard, pas de signal sectoriel fort identifié.',
  angle: 'Rester générique et laisser le prospect qualifier lui-même son niveau de douleur sur le churn dès les premières secondes.',
  accroche: 'On aide les boîtes en abonnement à repérer les clients qui vont partir avant qu\'ils annulent, pas après.',
  question: 'Aujourd\'hui, comment vous savez qu\'un client est sur le point de partir ?',
};

export function getApproachHint(sector: string | null | undefined): ApproachHint {
  if (!sector) return DEFAULT_HINT;
  const rule = RULES.find((r) => r.match.test(sector));
  return rule?.hint ?? DEFAULT_HINT;
}
