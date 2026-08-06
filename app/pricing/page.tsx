'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from '@/components/Navigation';
import MagicHexagon from '@/components/MagicHexagon';
import { EASE_OUT } from '@/lib/animations';
import { calcPricing, formatEuro } from '@/lib/pricing';
import { ArrowRight } from 'lucide-react';

const DEFAULT_CLIENT_COUNT = 100;

function getChurnLabel(rate: number): { label: string; className: string } {
  if (rate < 5) return { label: 'Excellent', className: 'text-emerald-600' };
  if (rate < 10) return { label: 'Bon', className: 'text-lime-600' };
  if (rate < 15) return { label: 'À surveiller', className: 'text-orange-600' };
  return { label: 'Critique', className: 'text-red-600' };
}

export default function PricingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [monthlyRevenue, setMonthlyRevenue] = useState(100000);
  const [churnRate, setChurnRate] = useState(5);
  const [isCalculating, setIsCalculating] = useState(false);

  const pricing = calcPricing({ clients: DEFAULT_CLIENT_COUNT, revenue: monthlyRevenue, churn: churnRate });
  const churnLabel = getChurnLabel(churnRate);

  function handleCalculate() {
    setIsCalculating(true);
    setTimeout(() => {
      setIsCalculating(false);
      setStep(3);
    }, 2200);
  }

  return (
    <>
      <Navigation user={null} />

      <main className="relative flex min-h-[calc(100vh-73px)] flex-col items-center justify-center overflow-hidden px-6 py-16">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
              className="flex w-full max-w-md flex-col items-center text-center"
            >
              <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand-600">
                Voir nos tarifs
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Quel est votre chiffre d&apos;affaires mensuel ?
              </h1>

              <input
                type="range"
                min={10000}
                max={1000000}
                step={5000}
                value={monthlyRevenue}
                onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                className="mt-10 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600"
              />
              <motion.p
                key={monthlyRevenue}
                initial={{ scale: 0.9, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="mt-6 text-4xl font-extrabold text-brand-600"
              >
                {formatEuro(monthlyRevenue)}
              </motion.p>
              <p className="mt-4 text-sm text-slate-500">
                Cela nous aide à calculer votre risque de churn.
              </p>

              <motion.button
                onClick={() => setStep(2)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-12 flex items-center gap-2 rounded-full bg-brand-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700"
              >
                Suivant <ArrowRight className="h-4 w-4" />
              </motion.button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
              className="flex w-full max-w-md flex-col items-center text-center"
            >
              <p className="mb-2 text-sm text-slate-500">Étape 2/3</p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Quel est votre taux de churn mensuel ?
              </h2>

              {!isCalculating ? (
                <>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    step={1}
                    value={churnRate}
                    onChange={(e) => setChurnRate(Number(e.target.value))}
                    className="mt-10 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600"
                  />
                  <motion.p
                    key={churnRate}
                    initial={{ scale: 0.9, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className={`mt-6 text-4xl font-extrabold ${churnLabel.className}`}
                  >
                    {churnRate}%<span className="ml-2 text-lg text-slate-500">{churnLabel.label}</span>
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-600"
                  >
                    <strong>Si vous ne savez pas :</strong> le churn moyen est d&apos;environ 5 à 8 % par mois
                    (~50 % par an).
                  </motion.div>

                  <motion.button
                    onClick={handleCalculate}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="mt-12 flex items-center gap-2 rounded-full bg-brand-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700"
                  >
                    Calculer mon prix <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="mt-12 flex flex-col items-center"
                >
                  <MagicHexagon variant="large" churnRate={churnRate} status="loading" />
                  <p className="mt-4 text-sm text-slate-500">On calcule votre prix…</p>
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
              className="relative flex w-full max-w-md flex-col items-center text-center"
            >
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.12]">
                <MagicHexagon variant="large" churnRate={churnRate} status="success" />
              </div>

              <div className="relative z-10">
                <motion.p
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="text-6xl font-extrabold text-brand-600"
                >
                  {formatEuro(pricing.monthly)}
                  <span className="text-2xl font-medium text-slate-400">/mois</span>
                </motion.p>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="mt-4 text-sm text-slate-500"
                >
                  Score de risque {pricing.score.toFixed(1)} · Palier {pricing.tierName} — basé sur un CA de{' '}
                  {formatEuro(monthlyRevenue)}/mois et {churnRate}% de churn.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/60 p-5"
                >
                  <p className="font-semibold text-brand-700">
                    Ou {formatEuro(pricing.annualPerMonth)}/mois en annuel
                  </p>
                  <p className="mt-1 text-xs text-brand-600">1 mois offert sur l&apos;engagement annuel</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="mt-5 inline-block rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-500"
                >
                  ✓ Engagement 0 · Annulez quand vous voulez
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.6 }}
                  className="mt-10 flex w-full flex-col gap-3"
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push('/signup')}
                    className="rounded-full bg-brand-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700"
                  >
                    S&apos;abonner maintenant
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push('/')}
                    className="rounded-full border-2 border-brand-600 px-8 py-4 text-sm font-semibold text-brand-600 transition hover:bg-brand-50"
                  >
                    Voir la démo
                  </motion.button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
