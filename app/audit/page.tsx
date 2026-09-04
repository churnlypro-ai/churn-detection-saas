'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const COPY = {
  fr: {
    eyebrow: 'Audit gratuit, 2 minutes',
    title: 'Combien avez-vous perdu sur des paiements que Stripe ne récupérera jamais ?',
    subtitle:
      'Connectez votre compte Stripe pour voir, sur vos 6 derniers mois, ce qui a réellement échoué — et la part que Stripe ne relance jamais tout seul (carte perdue, volée, authentification requise...). Aucune inscription requise.',
    trust1: 'Aucune écriture sur votre compte, jamais.',
    trust2: 'Rien n\'est conservé après le calcul — le compte est déconnecté automatiquement.',
    button: 'Connecter Stripe et voir mon audit',
    loading: 'Connexion à Stripe…',
    deniedError: 'Connexion annulée — vous pouvez réessayer quand vous voulez.',
    genericError: 'L\'audit a échoué — réessaie.',
  },
  en: {
    eyebrow: 'Free audit, 2 minutes',
    title: 'How much have you lost on payments Stripe will never recover?',
    subtitle:
      'Connect your Stripe account to see, over the last 6 months, what actually failed — and the share Stripe never retries on its own (lost or stolen card, authentication required...). No signup required.',
    trust1: 'No write access to your account, ever.',
    trust2: 'Nothing is kept after the calculation — the account is disconnected automatically.',
    button: 'Connect Stripe and see my audit',
    loading: 'Connecting to Stripe…',
    deniedError: 'Connection canceled — you can try again anytime.',
    genericError: 'The audit failed — try again.',
  },
} as const;

function AuditContent() {
  const { language } = useLanguage();
  const t = COPY[language];
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resultParam = searchParams.get('result');
  const initialError = resultParam === 'denied' ? t.deniedError : resultParam === 'error' ? t.genericError : '';

  async function handleConnect() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      if (!res.ok) throw new Error(t.genericError);
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
      setLoading(false);
    }
  }

  return (
    <>
      <Navigation user={null} />
      <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t.eyebrow}
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            {t.title}
          </h1>
          <p className="mt-4 text-base text-slate-500 dark:text-slate-400">{t.subtitle}</p>

          {(error || initialError) && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error || initialError}</p>
          )}

          <button
            onClick={handleConnect}
            disabled={loading}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.loading}
              </>
            ) : (
              <>
                {t.button}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <div className="mt-6 space-y-1 text-xs text-slate-400 dark:text-slate-500">
            <p>{t.trust1}</p>
            <p>{t.trust2}</p>
          </div>
        </motion.div>
      </main>
    </>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={null}>
      <AuditContent />
    </Suspense>
  );
}
