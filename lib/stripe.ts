import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2025-03-31.basil' as Stripe.LatestApiVersion,
    });
  }
  return stripeClient;
}

// calcPrice() (lib/pricing.ts) renvoie désormais un point parmi des dizaines
// de valeurs possibles sur une échelle continue (60€, puis +50€ tous les
// 2 000€ de CA, sans plafond) — pré-créer un Stripe Price par valeur
// possible n'est plus praticable. Stripe accepte un prix calculé à la volée
// via price_data à la place d'un Price existant, aussi bien en création
// d'abonnement (checkout.sessions.create) qu'en mise à jour d'un item
// d'abonnement existant (subscriptions.update) — un seul Product Stripe
// fixe suffit, réutilisé par tous les montants.
export function priceDataForAmount(amountEuros: number, productId: string): Stripe.SubscriptionUpdateParams.Item.PriceData {
  return {
    currency: 'eur',
    product: productId,
    unit_amount: Math.round(amountEuros * 100),
    recurring: { interval: 'month' },
  };
}
