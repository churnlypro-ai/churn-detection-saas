'use client';

import { motion } from 'framer-motion';
import { Euro, TrendingDown, Users, AlertTriangle } from 'lucide-react';

function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

interface MetricCardsProps {
  mrr: number;
  churnRate: number;
  ltv: number;
  atRisk?: number;
}

export default function MetricCards({ mrr, churnRate, ltv, atRisk }: MetricCardsProps) {
  const cards = [
    { label: 'MRR Total', value: formatEuro(mrr), icon: Euro, accent: 'text-slate-900' },
    { label: 'Churn Rate', value: `${(churnRate ?? 0).toFixed(1)}%`, icon: TrendingDown, accent: 'text-red-500' },
    { label: 'LTV Moyen', value: formatEuro(ltv), icon: Users, accent: 'text-slate-900' },
    ...(atRisk !== undefined
      ? [{ label: 'Clients à risque', value: `${atRisk}`, icon: AlertTriangle, accent: 'text-amber-600' }]
      : []),
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
          whileHover={{ y: -3 }}
          className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
            <card.icon className={`h-4 w-4 ${card.accent}`} />
          </div>
          <p className="text-2xl font-bold text-slate-900">{card.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
