'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';
import { calcPricing, formatEuro, ASSUMED_CHURN_RATE } from '@/lib/pricing';
import { TrendingDown, Users, Euro, ShieldCheck, ArrowRight, AlertTriangle, Clock } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/LanguageContext';

interface Profile {
  company_name: string;
  subscription_tier: string | null;
  subscription_status: string;
  client_count: number | null;
  monthly_revenue: number | null;
  industry: string | null;
  churn_rate: number | null;
  trial_used: boolean | null;
}

function useCountUp(target: number, duration = 1.5, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number;
    const tick = (now: number) => {
      if (!startTime) startTime = now;
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, start]);
  return value;
}

function useRealTimeCounter(perSecond: number, active: boolean) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number>(0);
  useEffect(() => {
    if (!active) return;
    startRef.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      setValue(elapsed * perSecond);
    }, 100);
    return () => clearInterval(interval);
  }, [perSecond, active]);
  return value;
}

export default function ImpactPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string; created_at?: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [inView, setInView] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const t = useTranslations('impact');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) { router.replace('/login'); return; }
      setUser(data.user);
      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      setProfile(profileData as Profile);
      setLoading(false);
      setTimeout(() => setInView(true), 200);
    });
  }, [router]);

  async function handleSubscribe(wantsTrial: boolean = true) {
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
        body: JSON.stringify({ wantsTrial }),
      });

      if (!response.ok) throw new Error(t.checkoutErrorStart);

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : t.checkoutErrorFallback);
      setCheckoutLoading(false);
    }
  }

  const clients = Number(profile?.client_count ?? 100);
  const revenue = Number(profile?.monthly_revenue ?? 50000);
  // Pas encore d'analyse à ce stade la plupart du temps : le churn_rate réel
  // n'existe qu'une fois de vraies données importées (voir /api/analyze).
  // En attendant, on illustre avec une moyenne sectorielle assumée.
  const churn = Number(profile?.churn_rate ?? ASSUMED_CHURN_RATE);
  const pricing = calcPricing(revenue);

  const clientsLostPerDay = (clients * churn) / 100 / 30;
  const clientsLostPerMonth = (clients * churn) / 100;
  const clientsLostPerYear = clientsLostPerMonth * 12;

  // Un compteur rond affiche "0 client" dès que la valeur réelle est sous
  // 0.5 (ex: 1 client à 5% de churn) — trompeur puisque le risque n'est pas
  // nul. On plafonne l'affichage à au moins 1 dès qu'il y a un churn réel
  // sur au moins un client, sans changer les montants de revenue (précis).
  const hasRealRisk = clients > 0 && churn > 0;
  const clientsLostPerMonthDisplay = hasRealRisk ? Math.max(1, clientsLostPerMonth) : clientsLostPerMonth;
  const clientsLostPerYearDisplay = hasRealRisk ? Math.max(1, clientsLostPerYear) : clientsLostPerYear;

  const arpu = clients > 0 ? revenue / clients : 0;
  const revenueLostPerDay = arpu * clientsLostPerDay;
  const revenueLostPerMonth = arpu * clientsLostPerMonth;
  const revenueLostPerYear = arpu * clientsLostPerYear;

  const savedClientsPerMonth = clientsLostPerMonthDisplay * 0.5;
  const savedRevenuePerMonth = revenueLostPerMonth * 0.5;
  const roi = pricing.monthly > 0 ? Math.round(savedRevenuePerMonth / pricing.monthly) : 0;
  const breakEvenWeeks = savedRevenuePerMonth > 0 ? Math.max(1, Math.ceil((pricing.monthly * 4) / (savedRevenuePerMonth * 4) * 2)) : 0;

  const realTimeLoss = useRealTimeCounter(revenueLostPerDay / 86400, inView);

  const animatedClientsDay = useCountUp(clientsLostPerDay, 1.5, inView);
  const animatedClientsMonth = useCountUp(clientsLostPerMonthDisplay, 1.5, inView);
  const animatedClientsYear = useCountUp(clientsLostPerYearDisplay, 1.5, inView);
  const animatedRevDay = useCountUp(revenueLostPerDay, 1.5, inView);
  const animatedRevMonth = useCountUp(revenueLostPerMonth, 1.5, inView);
  const animatedRevYear = useCountUp(revenueLostPerYear, 1.5, inView);
  const animatedSavedClients = useCountUp(savedClientsPerMonth, 1.5, inView);
  const animatedSavedRev = useCountUp(savedRevenuePerMonth, 1.5, inView);
  const animatedRoi = useCountUp(roi, 1.5, inView);

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

  return (
    <>
      <Navigation user={user} />

      <div className="sticky top-[73px] z-40 border-b border-slate-100 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.yourPrice}</span>
            <motion.span key={pricing.monthly} initial={{ opacity: 0.5, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-lg font-extrabold text-brand-700 dark:text-brand-400">
              {formatEuro(pricing.monthly)}<span className="text-sm font-medium text-slate-400 dark:text-slate-500">{t.perMonth}</span>
            </motion.span>
          </div>
          <div className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
            {t.monthlyAnnualNote(formatEuro(pricing.annualPerMonth))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }} className="mb-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">{t.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">{t.title}</h1>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.2 }} className="mb-8">
          <h2 className="mb-6 text-center text-xl font-bold text-slate-900 dark:text-white">{t.losingNowTitle}</h2>
          <div className="rounded-3xl border border-red-100 bg-red-50/40 p-8 dark:border-red-800/40 dark:bg-red-950/10">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="text-center">
                <Users className="mx-auto mb-2 h-6 w-6 text-red-400" />
                <p className="text-3xl font-extrabold text-red-600 dark:text-red-400">{animatedClientsDay.toFixed(1)}</p>
                <p className="mt-1 text-xs text-red-400">{t.perDay}</p>
              </div>
              <div className="text-center">
                <Users className="mx-auto mb-2 h-6 w-6 text-red-400" />
                <p className="text-3xl font-extrabold text-red-600 dark:text-red-400">{Math.round(animatedClientsMonth)}</p>
                <p className="mt-1 text-xs text-red-400">{t.perMonthClients}</p>
              </div>
              <div className="text-center">
                <Users className="mx-auto mb-2 h-6 w-6 text-red-400" />
                <p className="text-3xl font-extrabold text-red-600 dark:text-red-400">{Math.round(animatedClientsYear)}</p>
                <p className="mt-1 text-xs text-red-400">{t.perYear}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.3 }} className="mb-8">
          <h2 className="mb-6 text-center text-xl font-bold text-slate-900 dark:text-white">{t.meansTitle}</h2>
          <div className="rounded-3xl border border-red-100 bg-red-50/40 p-8 dark:border-red-800/40 dark:bg-red-950/10">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="text-center">
                <Euro className="mx-auto mb-2 h-6 w-6 text-red-400" />
                <p className="text-3xl font-extrabold text-red-600 dark:text-red-400">{formatEuro(animatedRevDay)}</p>
                <p className="mt-1 text-xs text-red-400">{t.revenueLostPerDay}</p>
              </div>
              <div className="text-center">
                <Euro className="mx-auto mb-2 h-6 w-6 text-red-400" />
                <p className="text-3xl font-extrabold text-red-600 dark:text-red-400">{formatEuro(animatedRevMonth)}</p>
                <p className="mt-1 text-xs text-red-400">{t.revenueLostPerMonth}</p>
              </div>
              <div className="text-center">
                <Euro className="mx-auto mb-2 h-6 w-6 text-red-400" />
                <p className="text-3xl font-extrabold text-red-600 dark:text-red-400">{formatEuro(animatedRevYear)}</p>
                <p className="mt-1 text-xs text-red-400">{t.revenueLostPerYear}</p>
              </div>
            </div>
            <div className="mt-8 flex items-center justify-center gap-2 rounded-2xl bg-red-100/60 px-6 py-4 dark:bg-red-500/10">
              <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <Clock className="h-4 w-4 text-red-500" />
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">{t.sinceSignup(formatEuro(realTimeLoss))}</p>
            </div>
          </div>
        </motion.div>

        <div className="my-12 flex items-center gap-4">
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          <ShieldCheck className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        </div>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.4 }} className="mb-8">
          <h2 className="mb-6 text-center text-xl font-bold text-brand-700 dark:text-brand-400">{t.withChurnlyTitle}</h2>
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-8 dark:border-emerald-800/40 dark:bg-emerald-950/10">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="text-center">
                <TrendingDown className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">-50%</p>
                <p className="mt-1 text-xs text-emerald-500">{t.churnReduction}</p>
              </div>
              <div className="text-center">
                <Users className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{Math.round(animatedSavedClients)}</p>
                <p className="mt-1 text-xs text-emerald-500">{t.clientsSavedPerMonth}</p>
              </div>
              <div className="text-center">
                <Euro className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{formatEuro(animatedSavedRev)}</p>
                <p className="mt-1 text-xs text-emerald-500">{t.revenueSavedPerMonth}</p>
              </div>
              <div className="text-center">
                <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{Math.round(animatedRoi)}x</p>
                <p className="mt-1 text-xs text-emerald-500">{t.roiOnInvestment}</p>
              </div>
            </div>
            <div className="mt-6 rounded-xl bg-emerald-100/50 px-6 py-3 text-center dark:bg-emerald-500/10">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{t.profitableIn(breakEvenWeeks)}</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.5 }} className="space-y-3">
          <button
            onClick={() => handleSubscribe(true)}
            disabled={checkoutLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-brand-600/30 transition hover:-translate-y-0.5 hover:bg-brand-700 disabled:opacity-60"
          >
            {checkoutLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {t.redirecting}
              </>
            ) : (
              <>
                {t.startButton(formatEuro(pricing.monthly))} <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
          {profile?.industry !== 'manager' && !profile?.trial_used && (
            <button
              onClick={() => handleSubscribe(false)}
              disabled={checkoutLoading}
              className="flex w-full items-center justify-center text-xs font-medium text-slate-400 underline-offset-2 transition hover:text-slate-600 hover:underline disabled:opacity-60 dark:text-slate-500 dark:hover:text-slate-300"
            >
              {t.payNowLink(formatEuro(pricing.monthly))}
            </button>
          )}
          {checkoutError && (
            <p className="text-center text-sm text-red-600 dark:text-red-400">{checkoutError}</p>
          )}
          <button onClick={() => router.push('/dashboard')} className="flex w-full items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            {t.seeDashboard}
          </button>
        </motion.div>
      </main>
    </>
  );
}
