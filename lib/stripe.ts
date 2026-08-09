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

// Keys must match the tier prices returned by calcPrice() in lib/pricing.ts —
// that's the pricing engine actually used by signup/settings/preview/pricing.
export const PRICE_IDS: Record<string, string | undefined> = {
  '150': process.env.STRIPE_PRICE_150,
  '250': process.env.STRIPE_PRICE_250,
  '400': process.env.STRIPE_PRICE_400,
  '600': process.env.STRIPE_PRICE_600,
  '800': process.env.STRIPE_PRICE_800,
};
