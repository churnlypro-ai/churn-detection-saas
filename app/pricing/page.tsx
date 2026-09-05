'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';
import { supabase } from '@/lib/supabase';
import { calcPrice, calcPerformanceBaseFee, formatEuro } from '@/lib/pricing';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/LanguageContext';

const DEFAULT_CLIENT_COUNT = 100;

function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-2xl divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((item, i) => (
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
  const [monthlyRevenue, setMonthlyRevenue] = useState(100000);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const t = useTranslations('pricing');
  const tFooter = useTranslations('home').footer;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser({ id: data.user.id, email: data.user.email });
    });
  }, []);

  // Les deux prix sont calculés à partir de la même barre de CA, affichés
  // côte à côte pour comparer directement — voir lib/pricing.ts pour le
  // détail des deux formules (Standard sans plafond, Performance plafonné
  // à 300€ mais plus bas au départ).
  const standardPrice = calcPrice(monthlyRevenue);
  const standardAnnualPerMonth = Math.round((standardPrice * 12 - standardPrice) / 12);
  const performancePrice = calcPerformanceBaseFee(monthlyRevenue);

  async function handleSubscribe(billingMode: 'revenue_tier' | 'performance') {
    if (!user) {
      router.push('/signup');
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // Le socle facturé (les deux plans, voir lib/pricing.ts) est recalculé
      // côté serveur à partir du profil en base (voir
      // /api/create-checkout-session et lib/performanceBilling.ts) — on
      // enregistre donc la valeur de la barre sur le compte avant de payer,
      // pour que le prix facturé corresponde bien à ce qui vient d'être
      // affiché à l'écran, quel que soit le plan choisi.
      await supabase
        .from('users')
        .update({ client_count: DEFAULT_CLIENT_COUNT, monthly_revenue: monthlyRevenue })
        .eq('id', user.id);

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ billingMode }),
      });

      if (!response.ok) throw new Error(t.checkoutErrorStart);

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : t.checkoutErrorFallback);
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
          {t.eyebrow}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }}
          className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl"
        >
          {t.title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.2 }}
          className="mx-auto mt-4 max-w-lg text-lg text-slate-600 dark:text-slate-400"
        >
          {t.subtitle}
        </motion.p>
      </section>

      {/* Barre de CA tout en haut de page — les deux prix ci-dessous se
          recalculent en direct à chaque changement, pour comparer les deux
          plans sur le même chiffre. */}
      <section className="mx-auto max-w-md px-6 py-10 text-center">
        <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">{t.step1Label}</p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {t.step1Title}
        </h2>

        <input
          type="range"
          min={1000}
          max={2000000}
          step={5000}
          value={monthlyRevenue}
          onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
          className="mt-8 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-700"
        />

        <div className="mt-6 flex items-center justify-center gap-3">
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
              aria-label={t.revenueAriaLabel}
            />
            <span className="text-sm text-slate-400 dark:text-slate-500">€</span>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{t.helperText}</p>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          <strong>{t.averageNoteBold}</strong> {t.averageNoteBody}
        </div>
      </section>

      <main className="px-6 pb-16">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.plans.standard.name}</p>
            <motion.p
              key={`standard-${standardPrice}`}
              initial={{ scale: 0.92, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="mt-3 text-5xl font-extrabold text-slate-900 dark:text-white"
            >
              {formatEuro(standardPrice)}
              <span className="text-xl font-medium text-slate-400 dark:text-slate-500">{t.perMonth}</span>
            </motion.p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.plans.standard.tagline}</p>

            <ul className="mt-6 space-y-2 text-left text-sm text-slate-600 dark:text-slate-400">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 dark:border-brand-800/40 dark:bg-brand-500/10">
              <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">
                {t.annualOfferPrefix} {formatEuro(standardAnnualPerMonth)}{t.annualOfferSuffix}
              </p>
              <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">{t.annualOfferNote}</p>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSubscribe('revenue_tier')}
              disabled={checkoutLoading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60 dark:hover:bg-brand-500"
            >
              {checkoutLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {t.redirecting}
                </>
              ) : user ? (
                t.subscribeNow
              ) : (
                t.createAccount
              )}
            </motion.button>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.plans.performance.name}</p>
            <motion.p
              key={`performance-${performancePrice}`}
              initial={{ scale: 0.92, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="mt-3 text-5xl font-extrabold text-slate-900 dark:text-white"
            >
              {formatEuro(performancePrice)}
              <span className="text-xl font-medium text-slate-400 dark:text-slate-500">{t.perMonth}</span>
            </motion.p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.plans.performance.tagline}</p>

            <ul className="mt-6 space-y-2 text-left text-sm text-slate-600 dark:text-slate-400">
              {t.plans.performance.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                  {b}
                </li>
              ))}
            </ul>

            <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">{t.plans.disclosure}</p>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSubscribe('performance')}
              disabled={checkoutLoading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60 dark:hover:bg-brand-500"
            >
              {checkoutLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {t.redirecting}
                </>
              ) : user ? (
                t.subscribeNow
              ) : (
                t.createAccount
              )}
            </motion.button>
          </div>
        </div>

        {checkoutError && (
          <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{checkoutError}</p>
        )}

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">{t.noCommitment}</p>
      </main>

      <section className="border-t border-slate-100 px-6 py-24 dark:border-slate-800">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="mb-12 text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl"
        >
          {t.faqTitle}
        </motion.h2>
        <FaqAccordion items={t.faq} />
      </section>

      <footer className="border-t border-slate-100 bg-white py-10 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 dark:text-slate-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Churnly</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-800 dark:hover:text-slate-300">{tFooter.privacy}</a>
            <a href="#" className="hover:text-slate-800 dark:hover:text-slate-300">{tFooter.terms}</a>
            <a href="#" className="hover:text-slate-800 dark:hover:text-slate-300">{tFooter.contact}</a>
          </div>
        </div>
      </footer>
    </>
  );
}
