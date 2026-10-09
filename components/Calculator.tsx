'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { EASE_OUT } from '@/lib/animations';
import { calcPrice, formatEuro } from '@/lib/pricing';
import { ArrowRight, Calendar } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/LanguageContext';
import { CallBookingModal } from '@/components/CallBookingModal';

// Résolution interne du curseur en échelle log : le curseur ne manipule
// jamais la valeur réelle directement, mais une position 0-LOG_STEPS dont
// chaque incrément représente le même facteur multiplicatif (et non le même
// écart absolu). Résultat : les petites valeurs, les plus courantes,
// occupent une grande partie de la piste, qui se resserre ensuite au fur et
// à mesure que la valeur grandit.
const LOG_STEPS = 1000;
const REVENUE_MIN = 500;
const REVENUE_MAX = 300000;

function valueToLogPosition(value: number, min: number, max: number): number {
  const clamped = Math.min(Math.max(value, min), max);
  const minLog = Math.log(min);
  const maxLog = Math.log(max);
  return ((Math.log(clamped) - minLog) / (maxLog - minLog)) * LOG_STEPS;
}

function logPositionToValue(position: number, min: number, max: number): number {
  const minLog = Math.log(min);
  const maxLog = Math.log(max);
  return Math.exp(minLog + (position / LOG_STEPS) * (maxLog - minLog));
}

// Les 5 premières tranches réelles de calcPrice (lib/pricing.ts) — 100 € de
// base puis +150 € tous les 10 000 € de CA, plafonné à 2 500 €/mois. Assez
// de lignes pour montrer la logique de la grille sans l'étaler en entier
// (le plafond n'est atteint qu'à 162 000 € de CA, soit 16 tranches).
const TIER_COUNT = 5;

export default function Calculator() {
  const [monthlyRevenue, setMonthlyRevenue] = useState(6500);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const t = useTranslations('calculator');

  const price = useMemo(() => calcPrice(monthlyRevenue), [monthlyRevenue]);

  const tiers = useMemo(() => {
    return Array.from({ length: TIER_COUNT }, (_, i) => {
      const lo = 2000 + i * 10000;
      const hi = lo + 9999;
      return {
        range: `${formatEuro(lo)} – ${formatEuro(hi)}`,
        price: formatEuro(Math.min(2500, 100 + 150 * i)),
        active: monthlyRevenue >= lo && monthlyRevenue <= hi,
      };
    });
  }, [monthlyRevenue]);

  const baseActive = monthlyRevenue < 2000;

  const breakdown = useMemo(() => {
    if (monthlyRevenue < 2000) return t.baseOnlyBreakdown;
    if (price >= 2500) return t.cappedBreakdown;
    const tranches = Math.floor((monthlyRevenue - 2000) / 10000);
    return t.trancheBreakdown(100, tranches, 150);
  }, [monthlyRevenue, price, t]);

  const sliderPos = Math.round(valueToLogPosition(monthlyRevenue, REVENUE_MIN, REVENUE_MAX));

  function handleSliderChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = logPositionToValue(Number(e.target.value), REVENUE_MIN, REVENUE_MAX);
    setMonthlyRevenue(Math.round(raw / 100) * 100);
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        className="mb-12 max-w-2xl"
      >
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">{t.eyebrow}</p>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {t.title} <span className="text-slate-400 dark:text-slate-500">{t.titleRest}</span>
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">{t.subtitle}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.1 }}
        className="grid grid-cols-1 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-2"
      >
        {/* LA RÈGLE */}
        <div className="flex flex-col gap-6 p-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t.ruleLabel}</span>

          <div
            className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 transition-colors ${
              baseActive
                ? 'border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10'
                : 'border-transparent'
            }`}
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-4xl font-medium tracking-tight text-slate-900 dark:text-white">{formatEuro(60)}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">{t.perMonth}</span>
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">{t.baseLabel}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-3xl font-medium tracking-tight text-brand-600 dark:text-brand-400">+ {formatEuro(150)}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">{t.perTrancheLabel}</span>
          </div>

          <code className="block rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 font-mono text-[13px] leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            prix = 100&nbsp;€ + 150&nbsp;€ × ⌊(CA − 2 000&nbsp;€) ÷ 10 000&nbsp;€⌋
          </code>

          <div className="flex flex-col gap-1.5">
            <div
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 font-mono text-[13px] transition-colors ${
                baseActive
                  ? 'border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10'
                  : 'border-transparent'
              }`}
            >
              <span className="text-slate-500 dark:text-slate-400">{t.lessThanLabel}</span>
              <span className={`font-semibold ${baseActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-900 dark:text-white'}`}>{formatEuro(60)}</span>
            </div>
            {tiers.map((tier) => (
              <div
                key={tier.range}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 font-mono text-[13px] transition-colors ${
                  tier.active
                    ? 'border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10'
                    : 'border-transparent'
                }`}
              >
                <span className="text-slate-500 dark:text-slate-400">{tier.range}</span>
                <span className={`font-semibold ${tier.active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-900 dark:text-white'}`}>{tier.price}</span>
              </div>
            ))}
            <span className="px-3 pt-1 text-xs text-slate-400 dark:text-slate-500">{t.tiersNote}</span>
          </div>
        </div>

        {/* CALCULEZ VOTRE PRIX */}
        <div className="flex flex-col gap-7 border-t border-slate-100 bg-slate-50/60 p-8 dark:border-slate-800 dark:bg-slate-950/40 lg:border-l lg:border-t-0">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t.calculateLabel}</span>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label htmlFor="cy-ca" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.revenueLabel}</label>
              <span className="font-mono text-2xl font-medium tracking-tight text-slate-900 dark:text-white">{formatEuro(monthlyRevenue)}</span>
            </div>
            <input
              id="cy-ca"
              type="range"
              min={0}
              max={LOG_STEPS}
              step={1}
              value={sliderPos}
              onChange={handleSliderChange}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-700"
            />
            <div className="flex justify-between font-mono text-[11px] text-slate-400 dark:text-slate-500">
              <span>{formatEuro(REVENUE_MIN)}</span>
              <span>{formatEuro(REVENUE_MAX)}</span>
            </div>
          </div>

          <motion.div
            key={price}
            initial={{ opacity: 0.6, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-6 dark:border-brand-500/35 dark:bg-brand-500/10"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-400">{t.yourPriceLabel}</span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-5xl font-medium tracking-tight text-brand-700 dark:text-brand-400">{formatEuro(price)}</span>
              <span className="text-base text-slate-500 dark:text-slate-400">{t.perMonth}</span>
            </div>
            <span className="font-mono text-[13px] text-slate-600 dark:text-slate-300">{breakdown}</span>
          </motion.div>

          <div className="mt-auto flex flex-col items-start gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/signup"
                className="flex items-center gap-2 rounded-full bg-gradient-to-b from-brand-500 to-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:brightness-105"
              >
                {t.ctaButton} <ArrowRight className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => setCallModalOpen(true)}
                className="flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900"
              >
                <Calendar className="h-4 w-4" /> {t.bookCall}
              </button>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500">{t.ctaNote}</span>
          </div>
        </div>
      </motion.div>

      <CallBookingModal open={callModalOpen} onClose={() => setCallModalOpen(false)} />
    </section>
  );
}
