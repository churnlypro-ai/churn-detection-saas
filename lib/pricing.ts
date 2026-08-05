export interface PricingInput {
  clients: number;
  revenue: number;
  churn: number;
}

export interface PricingResult {
  score: number;
  monthly: number;
  annual: number;
  annualPerMonth: number;
  tierName: string;
  monthlyLoss: number;
  annualLoss: number;
  savingsPerMonth: number;
  roi: number;
}

export function calcScore(clients: number, revenue: number, churn: number): number {
  return (clients / 100) + (revenue / 50000) + Math.max(0, churn - 5);
}

export function calcPrice(clients: number, revenue: number, churn: number): number {
  const score = calcScore(clients, revenue, churn);
  if (score <= 5) return 150;
  if (score <= 7) return 250;
  if (score <= 9) return 400;
  if (score <= 11) return 600;
  return 800;
}

export function tierName(price: number): string {
  if (price <= 150) return 'Petit';
  if (price <= 250) return 'Petit-Moyen';
  if (price <= 400) return 'Moyen';
  if (price <= 600) return 'Gros';
  return 'Enterprise';
}

export function calcPricing(input: PricingInput): PricingResult {
  const { clients, revenue, churn } = input;
  const monthly = calcPrice(clients, revenue, churn);
  const annual = monthly * 12;
  const annualPerMonth = Math.round((annual - monthly) / 12);
  const monthlyLoss = (revenue * churn) / 100;
  const annualLoss = monthlyLoss * 12;
  const savingsPerMonth = monthlyLoss * 0.5;
  const roi = monthly > 0 ? Math.round(savingsPerMonth / monthly) : 0;

  return {
    score: calcScore(clients, revenue, churn),
    monthly,
    annual,
    annualPerMonth,
    tierName: tierName(monthly),
    monthlyLoss,
    annualLoss,
    savingsPerMonth,
    roi,
  };
}

export function priceBreakdown(clients: number, revenue: number, churn: number): { label: string; amount: number }[] {
  const items: { label: string; amount: number }[] = [];
  const score = calcScore(clients, revenue, churn);
  items.push({ label: `Score: ${score.toFixed(1)}`, amount: calcPrice(clients, revenue, churn) });
  return items;
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}
