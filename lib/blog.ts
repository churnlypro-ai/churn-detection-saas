// Contenu du blog public (/blog) — canal SEO/contenu, voir la discussion
// sur les canaux marketing accessibles à ce stade. Volontairement statique
// (pas de CMS) : un tableau en dur suffit pour le volume d'articles prévu
// au démarrage, et évite une dépendance externe pour un contenu qui change
// rarement une fois publié.
export type BlogBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] };

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // ISO date
  blocks: BlogBlock[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'taux-de-churn-saas-normal-comment-le-reduire',
    title: 'Taux de churn SaaS : à partir de quel seuil s\'inquiéter, et comment le réduire',
    description:
      'Un churn mensuel qui semble anodin (3%, 5%, 7%) représente en réalité une perte de clientèle bien plus lourde sur un an. Comment lire ce chiffre et agir avant que les clients partent, pas après.',
    publishedAt: '2026-09-09',
    blocks: [
      {
        type: 'p',
        text: 'Un churn de 5% par mois. Vu isolément, ce chiffre ne semble pas alarmant — 95% des clients restent, chaque mois. Le problème, c\'est que ce taux se compose : un churn mensuel de 5% qui se répète chaque mois représente environ 46% de clients perdus sur un an, pas 60% (5% × 12) comme on pourrait le calculer trop vite, mais loin des 5% qu\'on regarde au tableau de bord chaque mois.',
      },
      {
        type: 'h2',
        text: 'Pourquoi le churn mensuel trompe',
      },
      {
        type: 'p',
        text: 'La plupart des SaaS suivent leur churn mois par mois, parce que c\'est le chiffre que Stripe ou leur outil de facturation affiche nativement. Le problème, c\'est que ce chiffre isolé ne dit rien de la trajectoire réelle de la base de clients. Deux entreprises à 5% de churn mensuel n\'ont pas le même problème si l\'une le maintient depuis six mois et l\'autre vient de passer de 2% à 5% — la deuxième a un problème qui s\'aggrave, pas un chiffre stable à surveiller de loin.',
      },
      {
        type: 'h2',
        text: 'Le vrai coût : rétention vs acquisition',
      },
      {
        type: 'p',
        text: 'Retenir un client coûte généralement 5 à 7 fois moins cher que d\'en acquérir un nouveau. Chaque euro dépensé en acquisition pour compenser un churn évitable est donc un euro dépensé pour rester au même niveau, pas pour grandir. Un SaaS qui investit dans la rétention avant que le client parte — plutôt qu\'après, quand il a déjà annulé — change fondamentalement cette équation.',
      },
      {
        type: 'h2',
        text: 'Agir avant le départ, pas après',
      },
      {
        type: 'p',
        text: 'La difficulté opérationnelle du churn, c\'est qu\'il ne prévient généralement pas : un client se désengage progressivement (moins d\'usage, moins de connexions, un ticket support non résolu) avant d\'annuler officiellement, mais peu d\'équipes ont le temps de repérer ce signal client par client dans leur fichier. C\'est exactement le créneau qu\'occupe Churnly : une analyse IA (Claude d\'Anthropic) du fichier clients qui attribue à chaque client un score de risque de 0 à 100, avec les facteurs qui l\'expliquent et une fenêtre de prédiction de 30 à 60 jours avant le départ probable — le temps d\'agir avant l\'annulation, pas après.',
      },
      {
        type: 'ul',
        items: [
          'Premier scan gratuit, sans carte bancaire — voyez votre vrai taux de churn avant toute décision.',
          'Aucune donnée personnelle de vos clients finaux n\'est conservée durablement ; suppression en un clic.',
          'Connexion directe à Stripe, Paddle ou Lemon Squeezy — pas de fichier à préparer à la main.',
        ],
      },
      {
        type: 'p',
        text: 'Si votre churn mensuel affiché vous semble raisonnable, faites le calcul composé sur douze mois avant de conclure que ce n\'est pas un problème — c\'est souvent là que la surprise se trouve.',
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
