'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';
import { AlertTriangle, Lock, Check, ShieldCheck, TrendingDown, Users, Euro } from 'lucide-react';

interface Profile {
  company_name: string;
  subscription_status: string;
  client_count: number | null;
  monthly_revenue: number | null;
  churn_rate: number | null;
}

import { calcPrice, tierName, formatEuro } from '@/lib/pricing';

function PreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uploadId = searchParams.get('uploadId');
  const checkoutStatus = searchParams.get('checkout');

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clientCount, setClientCount] = useState(0);
  const [atRiskCount, setAtRiskCount] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    if (!uploadId) return;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) {
        router.replace('/login');
        return;
      }
      setUser(data.user);

      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      const p = profileData as Profile;
      setProfile(p);

      if (p?.subscription_status === 'active') {
        router.replace('/dashboard');
        return;
      }

      const { data: results } = await supabase
        .from('analysis_results')
        .select('churn_score')
        .eq('upload_id', uploadId);

      setClientCount(results?.length ?? 0);
      setAtRiskCount((results ?? []).filter((r) => r.churn_score >= 60).length);
      setLoading(false);
    });
  }, [uploadId, router]);

  async function handleSubscribe() {
    setCheckoutLoading(true);
    setCheckoutError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // Le palier facturé est calculé côté serveur à partir du profil en
      // base (voir /api/create-checkout-session) — pas besoin de l'envoyer.
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });

      if (!response.ok) throw new Error('Impossible de démarrer le paiement.');

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navigation user={user} />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 dark:border-slate-700 dark:border-t-brand-500" />
        </div>
      </>
    );
  }

  const rev = Number(profile?.monthly_revenue ?? 0);
  const dynamicPrice = calcPrice(rev);

  return (
    <>
      <Navigation user={user} />

      <main className="mx-auto max-w-2xl px-6 py-20">
        <AnimatePresence>
          {checkoutStatus === 'cancelled' && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="mb-6 rounded-full border border-amber-200 bg-amber-50 px-5 py-2.5 text-center text-sm font-medium text-amber-700 dark:border-amber-800/40 dark:bg-amber-500/10 dark:text-amber-400"
            >
              Paiement annulé. Vous pouvez réessayer quand vous voulez.
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="rounded-3xl border border-slate-100 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Analyse complète</p>
          <p className="mt-2 text-lg text-slate-700 dark:text-slate-300">
            <span className="font-bold text-slate-900 dark:text-white">{clientCount}</span> clients analysés
          </p>

          <div className="mt-8 rounded-2xl bg-amber-50/60 px-6 py-8 dark:bg-amber-500/10">
            <div className="mb-2 flex items-center justify-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Clients à risque détectés
              </p>
            </div>
            <motion.p
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.2 }}
              className="text-5xl font-extrabold text-amber-700 dark:text-amber-400"
            >
              {atRiskCount}
            </motion.p>
          </div>

          {!showDetails && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              onClick={() => setShowDetails(true)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="mt-8 rounded-full bg-brand-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700"
            >
              Voir les détails
            </motion.button>
          )}
        </motion.div>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="mt-8"
            >
              <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-6 flex items-center justify-center gap-2">
                  <Lock className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Débloquez vos clients à risque</h2>
                </div>
                <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                  Pour voir qui sont ces {atRiskCount} clients, pourquoi ils sont à risque,
                  et comment les sauver — passez à Churnly Premium.
                </p>

                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.15 }}
                  className="mt-6 rounded-2xl border border-brand-100 bg-gradient-to-b from-brand-50/60 to-white p-6 dark:border-brand-800/40 dark:from-brand-500/10 dark:to-slate-900"
                >
                  <p className="text-center text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">Votre prix personnalisé</p>
                  <motion.p
                    key={dynamicPrice}
                    initial={{ opacity: 0.5, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-2 text-center text-5xl font-extrabold text-brand-700 dark:text-brand-400"
                  >
                    {formatEuro(dynamicPrice)}
                    <span className="text-lg font-medium text-slate-400 dark:text-slate-500">/mois</span>
                  </motion.p>

                  <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">Palier {tierName(dynamicPrice)} · basé sur votre CA mensuel</p>
                </motion.div>

                <div className="mt-6 space-y-2.5">
                  {[
                    'Liste complète des clients à risque',
                    'Score de churn et raison détaillée par client',
                    '5 templates d\'email personnalisés par client',
                    'Actions recommandées par IA',
                    'Mise à jour après chaque upload',
                  ].map((feature, i) => (
                    <motion.div
                      key={feature}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.3 + i * 0.08 }}
                      className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
                        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      {feature}
                    </motion.div>
                  ))}
                </div>

                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.6 }}
                  onClick={handleSubscribe}
                  disabled={checkoutLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {checkoutLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Redirection vers le paiement…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      S'abonner — {formatEuro(dynamicPrice)}/mois
                    </>
                  )}
                </motion.button>

                {checkoutError && (
                  <motion.p
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 text-center text-sm text-red-600 dark:text-red-400"
                  >
                    {checkoutError}
                  </motion.p>
                )}

                <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
                  Annulable à tout moment · Paiement sécurisé via Stripe
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}

export default function Preview() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 dark:border-slate-700 dark:border-t-brand-500" />
      </div>
    }>
      <PreviewContent />
    </Suspense>
  );
}
