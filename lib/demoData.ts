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
}

export const DEMO_CLIENTS: DemoClient[] = [
  {
    client_name: 'Atelier Rivière',
    revenue_monthly: 890,
    churn_score: 88,
    reason: 'Paiement en échec depuis 12 jours et aucune connexion depuis 3 semaines.',
    solution: 'Relancer directement par téléphone avant la date de renouvellement (dans 6 jours).',
  },
  {
    client_name: 'Nordvent Analytics',
    revenue_monthly: 2400,
    churn_score: 76,
    reason: 'Usage en chute de 60% ce mois-ci malgré un abonnement au tarif le plus élevé.',
    solution: 'Proposer un point d\'usage avec un chargé de compte pour comprendre le blocage.',
  },
  {
    client_name: 'Studio Lumen',
    revenue_monthly: 650,
    churn_score: 64,
    reason: '3 tickets support ouverts sans réponse depuis plus de 5 jours.',
    solution: 'Prioriser la résolution des tickets ouverts avant toute autre action commerciale.',
  },
  {
    client_name: 'Cabinet Fontaine & Associés',
    revenue_monthly: 1350,
    churn_score: 52,
    reason: 'Renouvellement dans 10 jours, engagement en légère baisse depuis 2 semaines.',
    solution: 'Envoyer un récapitulatif de la valeur générée avant la date de renouvellement.',
  },
  {
    client_name: 'Bloom Agency',
    revenue_monthly: 3200,
    churn_score: 38,
    reason: 'Usage stable mais aucun nouveau contact ajouté depuis 30 jours.',
    solution: 'Partager les nouvelles fonctionnalités disponibles pour relancer l\'engagement.',
  },
  {
    client_name: 'Kernel Software',
    revenue_monthly: 4500,
    churn_score: 22,
    reason: 'Compte très actif, aucun signal de risque détecté ce mois-ci.',
    solution: 'Aucune action requise — bon candidat pour une demande de témoignage.',
  },
  {
    client_name: 'Marché Vert Coopérative',
    revenue_monthly: 420,
    churn_score: 15,
    reason: 'Utilisation quotidienne stable, paiements toujours à jour.',
    solution: 'Compte sain — surveiller simplement au prochain cycle.',
  },
  {
    client_name: 'Voltis Energie',
    revenue_monthly: 1800,
    churn_score: 8,
    reason: 'Client historique, usage en hausse constante depuis 6 mois.',
    solution: 'Bon candidat pour une montée en gamme (upsell) au prochain renouvellement.',
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
