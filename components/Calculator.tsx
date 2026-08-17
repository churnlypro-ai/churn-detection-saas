'use client';

import { useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { EASE_OUT } from '@/lib/animations';
import { calcPricing, formatEuro, ASSUMED_CHURN_RATE } from '@/lib/pricing';
import { ArrowRight } from 'lucide-react';
import { useLanguage, useTierName, useTranslations } from '@/lib/i18n/LanguageContext';

function SliderField({ label, value, min, max, step, onChange, display, inputSuffix }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
  inputSuffix?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <label className="font-medium text-slate-700 dark:text-slate-300">{label}</label>
        <div className="flex items-center gap-1.5">
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
            onBlur={(e) => {
              const v = Number(e.target.value);
              onChange(Math.max(min, Math.min(max, Number.isNaN(v) ? min : v)));
            }}
            className="w-28 rounded-lg border border-slate-200 px-2.5 py-1.5 text-right text-sm font-semibold text-brand-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-brand-400"
          />
          {inputSuffix && <span className="text-xs text-slate-400 dark:text-slate-500">{inputSuffix}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-700"
      />
      <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{display}</p>
    </div>
  );
}

function Row({ label, value, bold, valueClassName = '' }: { label: string; value: string; bold?: boolean; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span className={`${bold ? 'text-lg font-bold' : 'font-medium'} ${valueClassName}`}>{value}</span>
    </div>
  );
}

export default function Calculator() {
  const [clientCount, setClientCount] = useState(100);
  const [monthlyRevenue, setMonthlyRevenue] = useState(50000);
  const t = useTranslations('calculator');
  const { localeTag } = useLanguage();
  const tierName = useTierName();

  const priceCardRef = useRef<HTMLDivElement>(null);
  const priceCardInView = useInView(priceCardRef, { once: false, amount: 0.3 });

  const stats = useMemo(() => {
    const pricing = calcPricing(monthlyRevenue);
    // Le prix ne dépend que du CA — le taux de churn n'est jamais demandé
    // (personne ne le connaît avant sa première analyse). Ces pertes sont
    // une illustration basée sur une moyenne sectorielle assumée.
    const clientsLostPerMonth = (clientCount * ASSUMED_CHURN_RATE) / 100;
    const arpu = clientCount > 0 ? monthlyRevenue / clientCount : 0;
    const revenueLostPerMonth = arpu * clientsLostPerMonth;
    const annualLoss = revenueLostPerMonth * 12;
    const improvedClientsLost = clientsLostPerMonth * 0.5;
    const improvedRevenueLost = arpu * improvedClientsLost;
    const annualSavings = (revenueLostPerMonth - improvedRevenueLost) * 12;
    const monthlySavings = revenueLostPerMonth - improvedRevenueLost;
    const roi = pricing.monthly > 0 ? Math.round(monthlySavings / pricing.monthly) : 0;

    return {
      ...pricing,
      arpu,
      clientsLostPerMonth,
      revenueLostPerMonth,
      annualLoss,
      improvedClientsLost,
      improvedRevenueLost,
      annualSavings,
      monthlySavings,
      roi,
    };
  }, [clientCount, monthlyRevenue]);

  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        className="mb-14 text-center"
      >
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {t.title}
        </h2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{t.subtitle}</p>
      </motion.div>

      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -32 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
          className="space-y-8 rounded-3xl border border-slate-100 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <SliderField
            label={t.clientCountLabel}
            value={clientCount}
            min={1}
            max={10000}
            step={1}
            onChange={setClientCount}
            display={`${t.clientsWord}: ${clientCount.toLocaleString(localeTag)}`}
          />
          <SliderField
            label={t.revenueLabel}
            value={monthlyRevenue}
            min={1000}
            max={2000000}
            step={1000}
            onChange={setMonthlyRevenue}
            display={`${t.revenueWord}: ${formatEuro(monthlyRevenue)}${t.perMonth}`}
            inputSuffix="€"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {t.helper}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 32 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
          className="flex flex-col gap-5"
        >
          <motion.div
            ref={priceCardRef}
            key={`price-${stats.monthly}`}
            initial={{ opacity: 0.6, scale: 0.98 }}
            animate={{ opacity: 1, scale: priceCardInView ? [1, 1.015, 1] : 1 }}
            transition={{ opacity: { duration: 0.4 }, scale: { duration: 3, repeat: priceCardInView ? Infinity : 0, ease: 'easeInOut' } }}
            className="rounded-3xl border border-brand-100 bg-brand-50/50 p-8 dark:border-brand-800/40 dark:bg-brand-500/5"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">{t.estimatedPrice}</p>
            <motion.p
              key={stats.monthly}
              initial={{ opacity: 0.5, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-4xl font-extrabold text-brand-700 dark:text-brand-400"
            >
              {formatEuro(stats.monthly)}<span className="text-lg font-medium text-slate-400 dark:text-slate-500">{t.perMonth}</span>
            </motion.p>
            <div className="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <Row label={t.monthlyLabel} value={t.monthlyValue} />
              <Row label={t.annualLabel} value={`${formatEuro(stats.annualPerMonth)}${t.annualSuffix}`} />
            </div>
            <div className="mt-4 border-t border-brand-200 pt-4 dark:border-brand-800/40">
              <Row label={t.gainLabel} value={`${formatEuro(stats.monthlySavings)}${t.perMonth}`} bold valueClassName="text-emerald-600 dark:text-emerald-400" />
            </div>
            <a
              href="/signup"
              className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 dark:hover:bg-brand-500"
            >
              {t.startButton} — {formatEuro(stats.monthly)}{t.perMonth} <ArrowRight className="h-4 w-4" />
            </a>
            <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
              {t.tierLabel}: {tierName(stats.tierName)}
            </p>
          </motion.div>

          <motion.div
            key={`impact-${stats.annualLoss}-${stats.annualSavings}`}
            initial={{ opacity: 0.6, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 divide-x divide-slate-100 overflow-hidden rounded-3xl border border-slate-100 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="p-5 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-400">{t.withoutTitle}</p>
              <p className="text-2xl font-extrabold text-red-600 dark:text-red-400">-{formatEuro(stats.annualLoss)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.withoutSub}</p>
            </div>
            <div className="p-5 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">{t.withTitle}</p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">+{formatEuro(stats.annualSavings)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.withSub} {stats.roi}x</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
