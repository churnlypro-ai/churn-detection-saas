'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { EASE_OUT } from '@/lib/animations';
import { calcPrice, formatEuro } from '@/lib/pricing';
import { ArrowRight, Calendar, Check } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/LanguageContext';
import { CallBookingModal } from '@/components/CallBookingModal';

// Résolution interne du curseur CA en échelle log : le curseur ne manipule
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

function NumberSliderField({ label, value, onChange, min, max, step, suffix }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-[15px] font-medium text-slate-700 dark:text-slate-300">{label}</label>
        <div className="flex w-[150px] flex-none items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v)) onChange(v);
            }}
            className="w-full min-w-0 bg-transparent text-right font-mono text-[15px] text-slate-900 focus:outline-none dark:text-white"
            aria-label={label}
          />
          <span className="flex-none text-xs text-slate-400 dark:text-slate-500">{suffix}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-700"
        aria-label={label}
      />
    </div>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-950">
      <span className="text-xs leading-snug text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-mono text-xl font-medium leading-tight tracking-tight text-slate-900 dark:text-white">{value}</span>
      {sub && <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{sub}</span>}
    </div>
  );
}

export default function Calculator() {
  const [clients, setClients] = useState(120);
  const [churn, setChurn] = useState(5);
  const [monthlyRevenue, setMonthlyRevenue] = useState(6500);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const t = useTranslations('calculator');

  const price = useMemo(() => calcPrice(monthlyRevenue), [monthlyRevenue]);

  const breakdown = useMemo(() => {
    if (monthlyRevenue < 2000) return t.baseOnlyBreakdown;
    if (price >= 2500) return t.cappedBreakdown;
    const tranches = Math.floor((monthlyRevenue - 2000) / 10000);
    return t.trancheBreakdown(100, tranches, 150);
  }, [monthlyRevenue, price, t]);

  const stats = useMemo(() => {
    const rate = churn / 100;
    const lostClientsPerMonth = clients * rate;
    const lostCaPerMonth = monthlyRevenue * rate;
    const keepRate = Math.pow(1 - rate, 12);
    const ca12 = monthlyRevenue * keepRate;
    const drop12 = Math.round((1 - keepRate) * 100);
    const arpu = clients > 0 ? monthlyRevenue / clients : 0;
    const keepCount = arpu > 0 ? Math.ceil(price / arpu) : 0;
    return { lostClientsPerMonth, lostCaPerMonth, ca12, drop12, keepCount };
  }, [clients, churn, monthlyRevenue, price]);

  const sliderPos = Math.round(valueToLogPosition(monthlyRevenue, REVENUE_MIN, REVENUE_MAX));

  function handleRevenueSliderChange(e: ChangeEvent<HTMLInputElement>) {
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
        {/* VOS CHIFFRES */}
        <div className="flex flex-col gap-7 p-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t.yourNumbersLabel}</span>

          <NumberSliderField label={t.clientCountLabel} value={clients} onChange={setClients} min={10} max={1000} step={10} suffix={t.clientsWord} />
          <NumberSliderField label={t.churnRateLabel} value={churn} onChange={setChurn} min={0.5} max={20} step={0.5} suffix="%" />
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="cy-ca" className="text-[15px] font-medium text-slate-700 dark:text-slate-300">{t.caLabel}</label>
              <span className="font-mono text-base text-slate-900 dark:text-white">{formatEuro(monthlyRevenue)}</span>
            </div>
            <input
              id="cy-ca"
              type="range"
              min={0}
              max={LOG_STEPS}
              step={1}
              value={sliderPos}
              onChange={handleRevenueSliderChange}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-700"
            />
          </div>

          <p className="mt-auto flex gap-2.5 border-t border-slate-100 pt-5 text-[13px] leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {t.onlyRevenueNote}
          </p>
        </div>

        {/* VOS RÉSULTATS */}
        <div className="flex flex-col gap-6 border-t border-slate-100 bg-gradient-to-b from-brand-50/60 to-transparent p-8 dark:border-slate-800 dark:from-brand-500/5 lg:border-l lg:border-t-0">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t.yourResultsLabel}</span>

          <div className="flex flex-col gap-1">
            <span className="text-sm text-slate-600 dark:text-slate-300">{t.subscriptionLabel}</span>
            <motion.div key={price} initial={{ opacity: 0.6, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex items-baseline gap-2">
              <span className="font-mono text-5xl font-medium tracking-tight text-brand-600 dark:text-brand-400">{formatEuro(price)}</span>
              <span className="text-base text-slate-500 dark:text-slate-400">{t.perMonth}</span>
            </motion.div>
            <span className="font-mono text-[12.5px] text-slate-500 dark:text-slate-400">{breakdown}</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <StatBox label={t.lostClientsLabel} value={stats.lostClientsPerMonth.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} />
            <StatBox label={t.lostCaLabel} value={formatEuro(stats.lostCaPerMonth)} />
            <StatBox label={t.ca12Label} value={formatEuro(stats.ca12)} sub={`−${stats.drop12} %`} />
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3.5 dark:border-brand-500/35 dark:bg-brand-500/10">
            <Check className="mt-0.5 h-4 w-4 flex-none text-brand-600 dark:text-brand-400" strokeWidth={3} />
            <span className="text-[15px] font-medium leading-snug text-slate-900 dark:text-white">{t.keepLabel(stats.keepCount)}</span>
          </div>

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
