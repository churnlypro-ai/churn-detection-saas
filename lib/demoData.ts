// Données fictives pour /demo — jamais lues ni écrites en base, jamais
// mélangées avec de vraies données client. Juste assez variées (paiement en
// échec, inactivité, forte utilisation) pour montrer ce que Churnly détecte
// réellement, sans avoir besoin d'un compte pour le voir.
export interface DemoClient {
  client_name: string;
  revenue_monthly: number;
  churn_score: number;
  reason: string;
  solution: string;
  // Email de rétention prêt à l'emploi, généré par Churnly à partir de la
  // raison détectée — exactement ce que le vrai produit fournit (voir
  // RetentionDraftsPanel côté /dashboard). Affiché sur /demo au clic pour
  // prouver concrètement que la "solution" n'est pas qu'une phrase, mais du
  // contenu prêt à envoyer.
  emailDraft: string;
  // Script d'appel suggéré, affiché sur /demo au clic sur "Demander un
  // appel" — mêmes raisons : montrer que la recommandation est adaptée au
  // client, pas un texte générique.
  callScript: string;
  // Offre spéciale recommandée, affichée sur /demo au clic sur "Offre
  // spéciale".
  specialOffer: string;
}

export const DEMO_CLIENTS: DemoClient[] = [
  {
    client_name: 'Atelier Rivière',
    revenue_monthly: 890,
    churn_score: 88,
    reason: 'Paiement en échec depuis 12 jours et aucune connexion depuis 3 semaines.',
    solution: 'Relancer directement par téléphone avant la date de renouvellement (dans 6 jours).',
    emailDraft: 'Bonjour,\n\nOn a remarqué que votre dernier paiement n\'est pas passé depuis 12 jours et que vous n\'avez pas eu l\'occasion de vous reconnecter récemment — tout va bien de votre côté ?\n\nVotre renouvellement arrive dans 6 jours : on préfère vous en parler directement plutôt que de vous laisser filer sans nouvelles. Vous êtes disponible pour un rapide appel cette semaine ?\n\nL\'équipe',
    callScript: 'Bonjour [Prénom], je vous appelle rapidement car votre dernier paiement n\'est pas passé et je n\'ai pas vu de connexion récente de votre côté — je voulais m\'assurer que tout allait bien.\n\nVotre renouvellement arrive dans 6 jours : qu\'est-ce qui vous empêche de vous reconnecter en ce moment ? On peut sûrement trouver une solution ensemble avant l\'échéance.',
    specialOffer: 'Renouvellement dans 6 jours : proposer 1 mois offert si le paiement est régularisé sous 48h, pour repartir sur de bonnes bases sans perdre l\'historique du compte.',
  },
  {
    client_name: 'Nordvent Analytics',
    revenue_monthly: 2400,
    churn_score: 76,
    reason: 'Usage en chute de 60% ce mois-ci malgré un abonnement au tarif le plus élevé.',
    solution: 'Proposer un point d\'usage avec un chargé de compte pour comprendre le blocage.',
    emailDraft: 'Bonjour,\n\nVotre usage a baissé de 60% ce mois-ci — rien d\'alarmant en soi, mais on préfère comprendre si quelque chose bloque de votre côté plutôt que de le découvrir trop tard.\n\nUn de nos chargés de compte peut faire un point de 15 minutes cette semaine pour voir comment mieux vous accompagner. Ça vous irait ?\n\nL\'équipe',
    callScript: 'Bonjour, j\'ai remarqué que votre usage a baissé de 60% ce mois-ci malgré votre abonnement au tarif le plus élevé — je voulais comprendre ce qui a changé de votre côté.\n\nQu\'est-ce qui bloque dans votre utilisation actuelle ? On peut voir ensemble comment mieux vous accompagner avant que ça n\'aille plus loin.',
    specialOffer: 'Tarif le plus élevé pour un usage en forte baisse : proposer un palier temporairement inférieur le temps de relancer l\'usage, plutôt que de risquer un désabonnement complet.',
  },
  {
    client_name: 'Studio Lumen',
    revenue_monthly: 650,
    churn_score: 64,
    reason: '3 tickets support ouverts sans réponse depuis plus de 5 jours.',
    solution: 'Prioriser la résolution des tickets ouverts avant toute autre action commerciale.',
    emailDraft: 'Bonjour,\n\n3 de vos tickets support sont ouverts depuis plus de 5 jours sans réponse de notre part — désolé pour l\'attente, ce n\'est pas le niveau de service qu\'on vise.\n\nOn les traite en priorité absolue dès aujourd\'hui et revient vers vous très vite avec des solutions concrètes.\n\nL\'équipe',
    callScript: 'Bonjour, je vous appelle au sujet des 3 tickets ouverts depuis plus de 5 jours sans réponse de notre part — sincèrement désolé pour l\'attente.\n\nJe veux comprendre l\'urgence de chacun avec vous maintenant et vous confirmer qu\'on les résout aujourd\'hui.',
    specialOffer: '3 tickets sans réponse depuis 5 jours : proposer un mois offert ou un crédit équivalent en geste commercial, une fois les tickets résolus.',
  },
  {
    client_name: 'Cabinet Fontaine & Associés',
    revenue_monthly: 1350,
    churn_score: 52,
    reason: 'Renouvellement dans 10 jours, engagement en légère baisse depuis 2 semaines.',
    solution: 'Envoyer un récapitulatif de la valeur générée avant la date de renouvellement.',
    emailDraft: 'Bonjour,\n\nVotre renouvellement approche dans 10 jours. Avant cette échéance, on voulait vous partager un rapide récapitulatif de ce que vous avez généré avec nous ces derniers mois — les résultats parlent d\'eux-mêmes.\n\nDites-nous si vous avez des questions avant de reconduire.\n\nL\'équipe',
    callScript: 'Bonjour, votre renouvellement approche dans 10 jours — je voulais faire un point rapide avec vous sur les résultats obtenus ces derniers mois et répondre à vos questions avant de reconduire.',
    specialOffer: 'Renouvellement dans 10 jours, engagement en légère baisse : proposer 10% de réduction sur le renouvellement s\'il est signé avant la date d\'échéance, en remerciement de leur fidélité.',
  },
  {
    client_name: 'Bloom Agency',
    revenue_monthly: 3200,
    churn_score: 38,
    reason: 'Usage stable mais aucun nouveau contact ajouté depuis 30 jours.',
    solution: 'Partager les nouvelles fonctionnalités disponibles pour relancer l\'engagement.',
    emailDraft: 'Bonjour,\n\nVotre usage reste stable, mais on a remarqué qu\'aucun nouveau contact n\'a été ajouté depuis 30 jours. On a justement sorti de nouvelles fonctionnalités qui pourraient vous aider à aller plus loin.\n\nÇa vous dit qu\'on vous fasse une démo rapide de 10 minutes ?\n\nL\'équipe',
    callScript: 'Bonjour, votre usage reste stable mais je vois qu\'aucun nouveau contact n\'a été ajouté depuis 30 jours — je voulais vous présenter rapidement nos nouvelles fonctionnalités qui pourraient relancer votre prospection.',
    specialOffer: 'Usage stable mais prospection à l\'arrêt : offrir un accès anticipé gratuit de 30 jours aux nouvelles fonctionnalités pour les inciter à les tester sans risque.',
  },
  {
    client_name: 'Kernel Software',
    revenue_monthly: 4500,
    churn_score: 22,
    reason: 'Compte très actif, aucun signal de risque détecté ce mois-ci.',
    solution: 'Aucune action requise — bon candidat pour une demande de témoignage.',
    emailDraft: 'Bonjour,\n\nVotre compte est l\'un des plus actifs de notre base, et tout se passe très bien de votre côté depuis le début.\n\nAccepteriez-vous de partager votre expérience dans un témoignage ou un cas client ? Ça aiderait d\'autres équipes comme la vôtre à se décider.\n\nL\'équipe',
    callScript: 'Bonjour, votre compte est l\'un des plus actifs de notre base — je voulais simplement prendre de vos nouvelles et voir si vous seriez partant pour partager votre expérience avec nous.',
    specialOffer: 'Compte sain, aucun risque détecté : pas d\'offre nécessaire — proposer plutôt un accès en avant-première aux prochaines fonctionnalités, en remerciement de leur fidélité.',
  },
  {
    client_name: 'Marché Vert Coopérative',
    revenue_monthly: 420,
    churn_score: 15,
    reason: 'Utilisation quotidienne stable, paiements toujours à jour.',
    solution: 'Compte sain — surveiller simplement au prochain cycle.',
    emailDraft: 'Bonjour,\n\nTout roule bien de votre côté — utilisation quotidienne stable, paiements toujours à jour. Rien à signaler.\n\nJuste un petit message pour vous dire qu\'on est là si vous avez besoin de quoi que ce soit.\n\nL\'équipe',
    callScript: 'Bonjour, tout se passe très bien de votre côté — je voulais juste prendre contact pour m\'assurer que vous avez tout ce qu\'il vous faut et répondre à d\'éventuelles questions.',
    specialOffer: 'Compte sain, paiements à jour : pas d\'offre nécessaire pour l\'instant — simplement surveiller au prochain cycle.',
  },
  {
    client_name: 'Voltis Energie',
    revenue_monthly: 1800,
    churn_score: 8,
    reason: 'Client historique, usage en hausse constante depuis 6 mois.',
    solution: 'Bon candidat pour une montée en gamme (upsell) au prochain renouvellement.',
    emailDraft: 'Bonjour,\n\nVotre usage ne cesse de grandir depuis 6 mois — bravo pour cette belle progression !\n\nVu votre utilisation actuelle, un palier supérieur pourrait mieux vous convenir, avec plus de marge pour continuer à grandir. On en discute avant votre prochain renouvellement ?\n\nL\'équipe',
    callScript: 'Bonjour, votre usage ne cesse de croître depuis 6 mois, bravo ! Je voulais échanger avec vous sur un palier supérieur qui vous donnerait plus de marge pour continuer à grandir, avant votre prochain renouvellement.',
    specialOffer: 'Usage en hausse constante depuis 6 mois : proposer 1 mois au tarif actuel pour tester le palier supérieur avant engagement définitif.',
  },
];

export const DEMO_INSIGHTS = 'À ce rythme, ces 8 comptes représentent 15 210€ de revenu mensuel — dont 3 340€ activement à risque ce mois-ci. En traitant les 2 comptes critiques en premier, l\'essentiel du risque peut être neutralisé avant leur date de renouvellement.';

function computeSummary() {
  const mrr = DEMO_CLIENTS.reduce((sum, c) => sum + c.revenue_monthly, 0);
  const churnRate = DEMO_CLIENTS.reduce((sum, c) => sum + c.churn_score, 0) / DEMO_CLIENTS.length;
  const ltv = mrr / DEMO_CLIENTS.length * 12;
  const atRisk = DEMO_CLIENTS.filter((c) => c.churn_score >= 60).length;
  return { mrr, churnRate, ltv, atRisk };
}

export const DEMO_SUMMARY = computeSummary();
