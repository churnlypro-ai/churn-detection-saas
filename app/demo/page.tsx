'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import Navigation from '@/components/Navigation';
import MetricCards from '@/components/MetricCards';
import ClientTable from '@/components/ClientTable';
import { EASE_OUT } from '@/lib/animations';
import { DEMO_CLIENTS } from '@/lib/demoData';
import { formatEuro } from '@/lib/pricing';

type Step = 'intro' | 'form' | 'loading' | 'result';

const LOADING_MESSAGES = [
  'Connexion à vos données…',
  'Analyse des signaux de risque…',
  'Calcul des recommandations…',
  'Génération du rapport…',
];

// Page publique, sans authentification : au lieu de balancer directement un
// dashboard rempli de données inconnues (confus pour un premier visiteur),
// on demande d'abord 3 chiffres sur sa propre situation, on simule
// l'analyse, puis on affiche le même dashboard qu'un vrai client verrait —
// mais avec ses propres ordres de grandeur en tête de page.
//
// Ce parcours guidé est réservé au lien "démo" partagé en prospection
// externe (LinkedIn, email, ads) — un visiteur déjà sur churnly.fr qui
// clique "Voir la démo" depuis l'accueil (voir AnimatedHero.tsx) connaît
// déjà Churnly et n'a pas besoin du hook d'accroche : ce lien-là passe
// ?direct=1 pour sauter direct au dashboard, comme avant.
function DemoContent() {
  const searchParams = useSearchParams();
  const isDirect = searchParams.get('direct') === '1';
  const [step, setStep] = useState<Step>(isDirect ? 'result' : 'intro');
  const [clientCount, setClientCount] = useState(100);
  const [monthlyRevenue, setMonthlyRevenue] = useState(50000);
  const [churnRate, setChurnRate] = useState(5);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [actionState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (step !== 'loading') return;
    setLoadingIndex(0);
    const interval = setInterval(() => {
      setLoadingIndex((prev) => {
        if (prev >= LOADING_MESSAGES.length - 1) {
          clearInterval(interval);
          setTimeout(() => setStep('result'), 500);
          return prev;
        }
        return prev + 1;
      });
    }, 550);
    return () => clearInterval(interval);
  }, [step]);

  const atRiskCount = Math.max(1, Math.min(clientCount, Math.round((clientCount * churnRate) / 100)));
  const revenueAtRisk = (monthlyRevenue * churnRate) / 100;
  const ltv = clientCount > 0 ? (monthlyRevenue / clientCount) * 12 : 0;

  return (
    <>
      <Navigation user={null} />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="mx-auto flex max-w-xl flex-col items-center gap-6 py-24 text-center"
            >
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
                Marre du <span className="text-brand-600 dark:text-brand-400">churn</span> ?
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Entrez 3 chiffres sur votre activité, on vous montre exactement ce que Churnly aurait détecté.
              </p>
              <button
                onClick={() => setStep('form')}
                className="mt-4 flex items-center gap-2 rounded-full bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 dark:hover:bg-brand-500"
              >
                Suivant <ArrowRight className="h-5 w-5" />
              </button>
            </motion.div>
          )}

          {step === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="mx-auto max-w-md py-16"
            >
              <h2 className="mb-2 text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Votre situation
              </h2>
              <p className="mb-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Des ordres de grandeur suffisent, pas besoin d&apos;être précis.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep('loading');
                }}
                className="space-y-5 rounded-3xl border border-slate-100 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre de clients</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={clientCount}
                    onChange={(e) => setClientCount(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">CA mensuel (€)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={monthlyRevenue}
                    onChange={(e) => setMonthlyRevenue(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Taux de churn estimé (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    required
                    value={churnRate}
                    onChange={(e) => setChurnRate(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 dark:hover:bg-brand-500"
                >
                  Voir mon analyse <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </motion.div>
          )}

          {step === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="mx-auto flex max-w-md flex-col items-center gap-8 py-32 text-center"
            >
              <Loader2 className="h-10 w-10 animate-spin text-brand-600 dark:text-brand-400" />
              <div className="w-full space-y-3 text-left">
                {LOADING_MESSAGES.map((msg, i) => (
                  <div key={msg} className="flex items-center gap-2.5 text-sm">
                    {i < loadingIndex ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                    ) : i === loadingIndex ? (
                      <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-brand-500" />
                    ) : (
                      <span className="h-4 w-4 flex-shrink-0 rounded-full border border-slate-200 dark:border-slate-700" />
                    )}
                    <span className={i <= loadingIndex ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'}>
                      {msg}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE_OUT }}
                className="mb-8 flex flex-col items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4 dark:border-brand-800/60 dark:bg-brand-500/10 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 flex-shrink-0 text-brand-600 dark:text-brand-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Votre analyse — illustration</p>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                      Basée sur vos chiffres ({clientCount} clients, {formatEuro(monthlyRevenue)}/mois, {churnRate}% de churn). Voici ce que Churnly détecterait sur vos vraies données.
                    </p>
                  </div>
                </div>
                <Link
                  href="/signup"
                  className="flex flex-shrink-0 items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 dark:hover:bg-brand-500"
                >
                  Essayer avec mes données <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: EASE_OUT }}
                className="mb-8 text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
              >
                Dashboard
              </motion.h1>

              <MetricCards
                mrr={monthlyRevenue}
                churnRate={churnRate}
                ltv={ltv}
                atRisk={atRiskCount}
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Vos insights</h2>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Sur vos {clientCount} clients, environ {atRiskCount} sont à risque ce mois-ci — soit {formatEuro(revenueAtRisk)} de revenu mensuel menacé. Traiter ces comptes en priorité peut neutraliser l&apos;essentiel du risque avant leur date de renouvellement.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="mt-6"
              >
                <ClientTable clients={DEMO_CLIENTS} actionState={actionState} onToggleAction={() => {}} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-lg font-semibold text-slate-900 dark:text-white">Prêt à voir vos vrais clients ?</p>
                <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">Importez un CSV ou connectez Stripe en 2 minutes — aucune carte bancaire requise pour commencer.</p>
                <Link
                  href="/signup"
                  className="mt-2 flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 dark:hover:bg-brand-500"
                >
                  Commencer gratuitement <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}

export default function Demo() {
  return (
    <Suspense fallback={null}>
      <DemoContent />
    </Suspense>
  );
}
