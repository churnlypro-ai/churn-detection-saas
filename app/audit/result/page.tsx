'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const COPY = {
  fr: {
    eyebrow: (days: number) => `Sur vos ${days} derniers jours`,
    failedLabel: 'Paiements échoués',
    unrecoverableLabel: 'Jamais récupérable par Stripe seul',
    unrecoverableNote:
      'Carte perdue, volée, authentification requise, numéro invalide... Stripe ne relance jamais ces cas — il faut une action humaine, sinon cet argent reste perdu.',
    zeroTitle: 'Bonne nouvelle : rien à signaler sur cette période.',
    zeroNote: 'Aucun paiement échoué détecté sur vos 6 derniers mois.',
    cta: 'Voir comment Churnly récupère le reste',
    ctaSub: 'Suivi automatique, alertes et relance — sans que ce soit à vous de chercher.',
  },
  en: {
    eyebrow: (days: number) => `Over your last ${days} days`,
    failedLabel: 'Failed payments',
    unrecoverableLabel: 'Never recoverable by Stripe alone',
    unrecoverableNote:
      'Lost card, stolen card, authentication required, invalid number... Stripe never retries these — it takes a human action, or that money stays lost.',
    zeroTitle: 'Good news: nothing to report for this period.',
    zeroNote: 'No failed payments detected over your last 6 months.',
    cta: 'See how Churnly recovers the rest',
    ctaSub: 'Automatic tracking, alerts and outreach — without you having to dig for it.',
  },
} as const;

function formatAmount(value: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(value);
}

function AuditResultContent() {
  const { language, localeTag } = useLanguage();
  const t = COPY[language];
  const searchParams = useSearchParams();

  const currency = searchParams.get('currency') || 'eur';
  const lookbackDays = Number(searchParams.get('lookbackDays') || 180);
  const failedCount = Number(searchParams.get('failedCount') || 0);
  const failedAmount = Number(searchParams.get('failedAmount') || 0);
  const unrecoverableCount = Number(searchParams.get('unrecoverableCount') || 0);
  const unrecoverableAmount = Number(searchParams.get('unrecoverableAmount') || 0);

  const hasFailures = failedCount > 0;

  return (
    <>
      <Navigation user={null} />
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        >
          <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">{t.eyebrow(lookbackDays)}</p>

          {!hasFailures ? (
            <>
              <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{t.zeroTitle}</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.zeroNote}</p>
            </>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t.failedLabel}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{formatAmount(failedAmount, currency, localeTag)}</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{failedCount}</p>
                </div>
                <div className="rounded-2xl border border-red-100 bg-red-50/40 p-6 shadow-sm dark:border-red-800/40 dark:bg-red-500/5">
                  <div className="flex items-center justify-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">{t.unrecoverableLabel}</p>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">{formatAmount(unrecoverableAmount, currency, localeTag)}</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{unrecoverableCount}</p>
                </div>
              </div>
              <p className="mx-auto mt-4 max-w-lg text-sm text-slate-500 dark:text-slate-400">{t.unrecoverableNote}</p>
            </>
          )}

          <Link
            href="/signup"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            {t.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{t.ctaSub}</p>
        </motion.div>
      </main>
    </>
  );
}

export default function AuditResultPage() {
  return (
    <Suspense fallback={null}>
      <AuditResultContent />
    </Suspense>
  );
}
