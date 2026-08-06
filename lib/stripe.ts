import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
    });
  }
  return stripeClient;
}

export const PRICE_IDS: Record<string, string | undefined> = {
  '300': process.env.STRIPE_PRICE_300,
  '500': process.env.STRIPE_PRICE_500,
  '1000': process.env.STRIPE_PRICE_1000,
};

export interface Tier {
  id: string;
  price: number;
  name: string;
  description: string;
  features: string[];
  recommended?: boolean;
}

export const TIERS: Tier[] = [
  {
    id: '300',
    price: 300,
    name: 'Essentiel',
    description: 'Tableau des clients à risque',
    features: [
      'Liste complète des clients à risque',
      'Score de churn par client',
      'Mise à jour quotidienne',
    ],
  },
  {
    id: '500',
    price: 500,
    name: 'Croissance',
    description: 'Tableau + solutions personnalisées',
    features: [
      'Tout le plan Essentiel',
      'Raison détaillée par client',
      'Actions recommandées personnalisées',
      "Boutons d'action (email, appel, offre)",
    ],
    recommended: true,
  },
  {
    id: '1000',
    price: 1000,
    name: 'Scale',
    description: 'Tout inclus + rapports hebdomadaires',
    features: [
      'Tout le plan Croissance',
      'Rapport hebdomadaire par email',
      'Intégration Stripe & Intercom',
      'Support prioritaire',
    ],
  },
];
