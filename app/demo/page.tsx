'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import Navigation from '@/components/Navigation';
import MetricCards from '@/components/MetricCards';
import ClientTable from '@/components/ClientTable';
import { EASE_OUT } from '@/lib/animations';
import { DEMO_CLIENTS, DEMO_SUMMARY, DEMO_INSIGHTS } from '@/lib/demoData';

// Page publique, sans authentification : montre à quoi ressemble le
// dashboard une fois connecté, avec des données fictives, pour qu'un
// prospect voie la valeur du produit avant même de créer un compte —
// utile en appel ou en DM pendant la prospection, sans friction.
export default function Demo() {
  const [actionState] = useState<Record<string, boolean>>({});

  return (
    <>
      <Navigation user={null} />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="mb-8 flex flex-col items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4 dark:border-brand-800/60 dark:bg-brand-500/10 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 flex-shrink-0 text-brand-600 dark:text-brand-400" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Démonstration — données fictives</p>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">Voici exactement ce que vous voyez une fois vos vraies données importées.</p>
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
          mrr={DEMO_SUMMARY.mrr}
          churnRate={DEMO_SUMMARY.churnRate}
          ltv={DEMO_SUMMARY.ltv}
          atRisk={DEMO_SUMMARY.atRisk}
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
          <p className="text-sm text-slate-600 dark:text-slate-400">{DEMO_INSIGHTS}</p>
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
      </main>
    </>
  );
}
