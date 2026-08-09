'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from '@/components/Navigation';
import MagicHexagon from '@/components/MagicHexagon';
import { EASE_OUT } from '@/lib/animations';
import { supabase } from '@/lib/supabase';
import { calcPrice, calcPricing, formatEuro } from '@/lib/pricing';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';

const DEFAULT_CLIENT_COUNT = 100;

const INCLUDED_FEATURES = [
  'Liste complète des clients à risque',
  'Score de churn détaillé par client',
  '5 templates d\'email personnalisés',
  'Actions recommandées par IA',
  'Support par email',
];

const FAQ_ITEMS = [
  {
    q: 'Comment le prix est-il calculé ?',
    a: 'Votre prix dépend de votre chiffre d\'affaires mensuel, de votre taux de churn et du nombre de clients. Plus votre risque de churn est élevé, plus l\'analyse a de valeur — le prix s\'ajuste automatiquement à votre situation.',
  },
  {
    q: 'Puis-je changer de palier plus tard ?',
    a: 'Oui. Votre palier est recalculé automatiquement à chaque mise à jour de vos données (CA, churn, nombre de clients) — vous n\'avez rien à faire manuellement.',
  },
  {
    q: 'Y a-t-il un engagement ?',
    a: 'Aucun. Vous pouvez annuler à tout moment depuis vos réglages, sans frais ni préavis.',
  },
  {
    q: 'Qu\'est-ce qui est inclus dans tous les plans ?',
    a: 'Tous les paliers incluent la liste complète de vos clients à risque, un score de churn détaillé, des templates d\'email personnalisés, des actions recommandées par IA, et le support par email.',
  },
  {
    q: 'Proposez-vous une remise à l\'engagement annuel ?',
    a: 'Oui — l\'engagement annuel revient à environ un mois offert par rapport au paiement mensuel.',
  },
  {
    q: 'Que se passe-t-il si mes chiffres changent après l\'inscription ?',
    a: 'Votre prix se recalcule automatiquement à partir de vos données réelles. Aucune surprise, aucune renégociation nécessaire.',
  },
];

const TIER_EXAMPLES = [
  { name: 'Petit', price: 150, description: 'Pour les équipes qui démarrent le suivi du churn.', highlight: false },
  { name: 'Moyen', price: 400, description: 'Pour les entreprises avec un risque de churn actif.', highlight: true },
  { name: 'Enterprise', price: 800, description: 'Pour les bases clients larges ou à fort enjeu.', highlight: false },
];

function getChurnLabel(rate: number): { label: string; className: string } {
  if (rate < 5) return { label: 'Excellent', className: 'text-emerald-600 dark:text-emerald-400' };
  if (rate < 10) return { label: 'Bon', className: 'text-lime-600 dark:text-lime-400' };
  if (rate < 15) return { label: 'À surveiller', className: 'text-orange-600 dark:text-orange-400' };
  return { label: 'Critique', className: 'text-red-600 dark:text-red-400' };
}

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-2xl divide-y divide-slate-100 dark:divide-slate-800">
      {FAQ_ITEMS.map((item, i) => (
        <div key={item.q} className="py-4">
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 text-left"
          >
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.q}</span>
            <ChevronDown
              className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-300 ${openIndex === i ? 'rotate-180' : ''}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {openIndex === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
                className="overflow-hidden"
              >
                <p className="pt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

export default function PricingPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [monthlyRevenue, setMonthlyRevenue] = useState(100000);
  const [churnRate, setChurnRate] = useState(5);
  const [isCalculating, setIsCalculating] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser({ id: data.user.id, email: data.user.email });
    });
  }, []);

  const pricing = calcPricing({ clients: DEFAULT_CLIENT_COUNT, revenue: monthlyRevenue, churn: churnRate });
  const churnLabel = getChurnLabel(churnRate);

  function handleCalculate() {
    setIsCalculating(true);
    setTimeout(() => {
      setIsCalculating(false);
      setStep(3);
    }, 2200);
  }

  async function handleSubscribe() {
    if (!user) {
      router.push('/signup');
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const tier = String(calcPrice(DEFAULT_CLIENT_COUNT, monthlyRevenue, churnRate));

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier }),
      });

      if (!response.ok) throw new Error('Impossible de démarrer le paiement.');

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      setCheckoutLoading(false);
    }
  }

  return (
    <>
      <Navigation user={user} />

      <section className="px-6 pb-4 pt-20 text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400"
        >
          Tarifs
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }}
          className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl"
        >
          Un prix qui s&apos;adapte à votre taille
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.2 }}
          className="mx-auto mt-4 max-w-lg text-lg text-slate-600 dark:text-slate-400"
        >
          Payez ce que vous utilisez. Zéro engagement.
        </motion.p>
      </section>

      <main className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-6 py-16">
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
              <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">Étape 1/3</p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                Quel est votre chiffre d&apos;affaires mensuel ?
              </h2>

              <input
                type="range"
                min={1000}
                max={2000000}
                step={5000}
                value={monthlyRevenue}
                onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                className="mt-10 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-700"
              />

              <div className="mt-6 flex items-center gap-3">
                <motion.p
                  key={monthlyRevenue}
                  initial={{ scale: 0.9, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-4xl font-extrabold text-brand-600 dark:text-brand-400"
                >
                  {formatEuro(monthlyRevenue)}
                </motion.p>
                <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                  <input
                    type="number"
                    min={1000}
                    max={2000000}
                    step={5000}
                    value={monthlyRevenue}
                    onChange={(e) => setMonthlyRevenue(Number(e.target.value) || 0)}
                    onBlur={(e) => setMonthlyRevenue(Math.max(1000, Math.min(2000000, Number(e.target.value) || 1000)))}
                    className="w-24 bg-transparent text-right text-sm font-semibold text-slate-700 focus:outline-none dark:text-slate-200"
                    aria-label="Chiffre d'affaires mensuel en euros"
                  />
                  <span className="text-sm text-slate-400 dark:text-slate-500">€</span>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                Cela nous aide à calculer votre risque de churn.
              </p>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                <strong>📊 C&apos;est une moyenne :</strong> ce chiffre représente votre CA mensuel moyen. Votre
                prix réel dépendra aussi de votre taux de churn et de la taille de votre client base. Ne vous
                inquiétez pas si ce n&apos;est pas parfait — nous adapterons automatiquement lors de la facturation.
              </div>

              <motion.button
                onClick={() => setStep(2)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-12 flex items-center gap-2 rounded-full bg-brand-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 dark:hover:bg-brand-500"
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
              <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">Étape 2/3</p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
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
                    className="mt-10 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-700"
                  />
                  <motion.p
                    key={churnRate}
                    initial={{ scale: 0.9, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className={`mt-6 text-4xl font-extrabold ${churnLabel.className}`}
                  >
                    {churnRate}%<span className="ml-2 text-lg text-slate-500 dark:text-slate-400">{churnLabel.label}</span>
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                  >
                    <strong>Si vous ne savez pas :</strong> le churn moyen est d&apos;environ 5 à 8 % par mois
                    (~50 % par an).
                  </motion.div>

                  <motion.button
                    onClick={handleCalculate}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="mt-12 flex items-center gap-2 rounded-full bg-brand-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 dark:hover:bg-brand-500"
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
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">On calcule votre prix…</p>
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
              className="relative flex w-full max-w-lg flex-col items-center text-center"
            >
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.08]">
                <MagicHexagon variant="large" churnRate={churnRate} status="success" />
              </div>

              <div className="relative z-10 w-full rounded-3xl border border-slate-100 bg-white p-10 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                  Votre plan personnalisé
                </p>

                <motion.p
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="mt-3 text-6xl font-extrabold text-slate-900 dark:text-white"
                >
                  {formatEuro(pricing.monthly)}
                  <span className="text-2xl font-medium text-slate-400 dark:text-slate-500">/mois</span>
                </motion.p>

                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Score de risque {pricing.score.toFixed(1)} · Palier {pricing.tierName}
                </p>

                <div className="mt-8 space-y-2.5 text-left">
                  {INCLUDED_FEATURES.map((feature, i) => (
                    <motion.div
                      key={feature}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.15 + i * 0.08 }}
                      className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
                        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      {feature}
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="mt-8 rounded-2xl border border-brand-100 bg-brand-50/60 p-5 dark:border-brand-800/40 dark:bg-brand-500/10"
                >
                  <p className="font-semibold text-brand-700 dark:text-brand-400">
                    Ou {formatEuro(pricing.annualPerMonth)}/mois en annuel
                  </p>
                  <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">1 mois offert sur l&apos;engagement annuel</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.6 }}
                  className="mt-8 flex w-full flex-col gap-3"
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubscribe}
                    disabled={checkoutLoading}
                    className="flex items-center justify-center gap-2 rounded-full bg-brand-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60 dark:hover:bg-brand-500"
                  >
                    {checkoutLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Redirection…
                      </>
                    ) : user ? (
                      "S'abonner maintenant"
                    ) : (
                      'Créer un compte pour continuer'
                    )}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push('/')}
                    className="rounded-full border-2 border-brand-600 px-8 py-4 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                  >
                    Voir la démo
                  </motion.button>
                  {checkoutError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{checkoutError}</p>
                  )}
                </motion.div>

                <p className="mt-5 text-xs text-slate-400 dark:text-slate-500">
                  Engagement 0 · Annulez quand vous voulez
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <section className="border-t border-slate-100 px-6 py-24 dark:border-slate-800">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="mb-4 text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl"
        >
          Des paliers à titre d&apos;exemple
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }}
          className="mx-auto mb-12 max-w-lg text-center text-sm text-slate-500 dark:text-slate-400"
        >
          Votre prix exact est calculé ci-dessus à partir de vos vrais chiffres — voici des repères pour situer votre palier.
        </motion.p>

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
          {TIER_EXAMPLES.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: i * 0.1 }}
              className={`rounded-3xl border p-8 ${
                tier.highlight
                  ? 'border-brand-200 bg-brand-50/60 shadow-lg shadow-brand-600/10 dark:border-brand-800/40 dark:bg-brand-500/5'
                  : 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{tier.name}</p>
              <p className="mt-2 text-4xl font-extrabold text-slate-900 dark:text-white">
                {formatEuro(tier.price)}<span className="text-base font-medium text-slate-400 dark:text-slate-500">/mois</span>
              </p>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{tier.description}</p>
              <ul className="mt-6 space-y-2 text-left text-sm text-slate-600 dark:text-slate-400">
                {INCLUDED_FEATURES.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-100 px-6 py-24 dark:border-slate-800">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="mb-12 text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl"
        >
          Questions fréquentes
        </motion.h2>
        <FaqAccordion />
      </section>

      <footer className="border-t border-slate-100 bg-white py-10 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 dark:text-slate-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Churnly</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-800 dark:hover:text-slate-300">Confidentialité</a>
            <a href="#" className="hover:text-slate-800 dark:hover:text-slate-300">Conditions</a>
            <a href="#" className="hover:text-slate-800 dark:hover:text-slate-300">Contact</a>
          </div>
        </div>
      </footer>
    </>
  );
}
