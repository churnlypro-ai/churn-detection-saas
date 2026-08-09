'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { EASE_OUT } from '@/lib/animations';
import { calcPricing, formatEuro } from '@/lib/pricing';
import { ArrowRight } from 'lucide-react';

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
            className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-right text-sm font-semibold text-brand-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-brand-400"
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
  const [churnRate, setChurnRate] = useState(5);

  const stats = useMemo(() => {
    const pricing = calcPricing({ clients: clientCount, revenue: monthlyRevenue, churn: churnRate });
    const clientsLostPerMonth = (clientCount * churnRate) / 100;
    const arpu = clientCount > 0 ? monthlyRevenue / clientCount : 0;
    const revenueLostPerMonth = arpu * clientsLostPerMonth;
    const annualLoss = revenueLostPerMonth * 12;
    const improvedClientsLost = clientsLostPerMonth * 0.5;
    const improvedRevenueLost = arpu * improvedClientsLost;
    const annualSavings = (revenueLostPerMonth - improvedRevenueLost) * 12;
    const monthlySavings = revenueLostPerMonth - improvedRevenueLost;

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
    };
  }, [clientCount, monthlyRevenue, churnRate]);

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
          Découvrez votre tarif en 30 secondes
        </h2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">Aucune inscription nécessaire. Bougez les curseurs, le prix se calcule en direct.</p>
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
            label="Nombre de clients"
            value={clientCount}
            min={1}
            max={10000}
            step={1}
            onChange={setClientCount}
            display={`Clients: ${clientCount.toLocaleString('fr-FR')}`}
          />
          <SliderField
            label="CA mensuel"
            value={monthlyRevenue}
            min={1000}
            max={2000000}
            step={1000}
            onChange={setMonthlyRevenue}
            display={`CA: ${formatEuro(monthlyRevenue)}/mois`}
            inputSuffix="€"
          />
          <SliderField
            label="Taux de churn"
            value={churnRate}
            min={1}
            max={50}
            step={0.5}
            onChange={setChurnRate}
            display={`Churn: ${churnRate}%`}
            inputSuffix="%"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 32 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
          className="flex flex-col gap-5"
        >
          <motion.div
            key={`price-${stats.monthly}`}
            initial={{ opacity: 0.6, scale: 0.98 }}
            animate={{ opacity: 1, scale: [1, 1.015, 1] }}
            transition={{ opacity: { duration: 0.4 }, scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
            className="rounded-3xl border border-brand-100 bg-brand-50/50 p-8 dark:border-brand-800/40 dark:bg-brand-500/5"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">Votre tarif estimé</p>
            <motion.p
              key={stats.monthly}
              initial={{ opacity: 0.5, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-4xl font-extrabold text-brand-700 dark:text-brand-400"
            >
              {formatEuro(stats.monthly)}<span className="text-lg font-medium text-slate-400 dark:text-slate-500">/mois</span>
            </motion.p>
            <div className="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <Row label="Mensuel" value="3 jours gratuits" />
              <Row label="Annuel" value={`${formatEuro(stats.annualPerMonth)}/mois (1 mois gratuit)`} />
            </div>
            <div className="mt-4 border-t border-brand-200 pt-4 dark:border-brand-800/40">
              <Row label="Gain vs perte churn" value={`${formatEuro(stats.savingsPerMonth)}/mois`} bold valueClassName="text-emerald-600 dark:text-emerald-400" />
            </div>
            <a
              href="/signup"
              className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 dark:hover:bg-brand-500"
            >
              Commencer — {formatEuro(stats.monthly)}/mois <ArrowRight className="h-4 w-4" />
            </a>
            <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
              Score: {stats.score.toFixed(1)} · Palier: {stats.tierName}
            </p>
          </motion.div>

          <motion.div
            key={`loss-${stats.annualLoss}`}
            initial={{ opacity: 0.6, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="rounded-3xl border border-red-100 bg-red-50/60 p-6 dark:border-red-800/40 dark:bg-red-950/20"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-400">Sans Churnly</p>
            <Row label="Clients perdus / mois" value={stats.clientsLostPerMonth.toFixed(1)} />
            <Row label="Revenue perdue / mois" value={formatEuro(stats.revenueLostPerMonth)} />
            <div className="mt-3 border-t border-red-200 pt-3 dark:border-red-800/40">
              <Row label="Perte annuelle" value={formatEuro(stats.annualLoss)} bold valueClassName="text-red-600 dark:text-red-400" />
            </div>
          </motion.div>

          <motion.div
            key={`saved-${stats.annualSavings}`}
            initial={{ opacity: 0.6, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6 dark:border-emerald-800/40 dark:bg-emerald-950/20"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Avec Churnly (-50% churn)</p>
            <Row label="Clients sauvés / mois" value={stats.improvedClientsLost.toFixed(1)} />
            <Row label="Revenue économisée / mois" value={formatEuro(stats.monthlySavings)} />
            <div className="mt-3 border-t border-emerald-200 pt-3 dark:border-emerald-800/40">
              <Row label="Économies annuelles" value={formatEuro(stats.annualSavings)} bold valueClassName="text-emerald-600 dark:text-emerald-400" />
              <Row label="ROI" value={`${stats.roi}x`} />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
