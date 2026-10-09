'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ShieldCheck, CreditCard, Trash2, Check, Plug, ArrowRight, Calendar } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/LanguageContext';
import { CallBookingModal } from '@/components/CallBookingModal';

const TRUST_ICONS = [Check, ShieldCheck, Trash2];

// Carte "mockup produit" du hero : toujours en tons navy foncés, dans les
// deux thèmes clair/sombre du site — comme une capture d'écran du vrai
// dashboard, qui ne change pas de palette avec le thème de la page autour
// d'elle. Les 3 jetons flottants ("Connecté en 2 minutes", "37 signaux",
// "Prêt à envoyer") utilisent une animation en boucle légère plutôt que le
// réseau de particules 3D précédent.
function DashboardMock() {
  const t = useTranslations('home').hero.mock;

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/20 blur-[90px]"
      />

      <p className="sr-only">
        Aperçu du tableau de bord Churnly : trois clients classés par score de risque, la raison du risque et un email de relance déjà rédigé.
      </p>

      <motion.div
        initial={{ opacity: 0, y: 24, rotateY: -6 }}
        animate={{ opacity: 1, y: 0, rotateY: -6 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformPerspective: 1400 }}
        className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/40"
      >
        <div className="flex items-baseline gap-2.5 border-b border-slate-800 px-4 py-3.5">
          <span className="text-[15px] font-bold tracking-tight text-white">Churnly</span>
          <span className="text-[13px] text-slate-400">{t.panelTitle}</span>
        </div>

        <div className="flex flex-col gap-1 px-2.5 pb-1 pt-2.5">
          <div className="flex items-center gap-3 rounded-xl bg-slate-800 px-2.5 py-2.5">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-slate-700 font-mono text-xs font-semibold text-slate-200">AN</span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold text-white">Atelier Nuances</p>
              <p className="font-mono text-[11px] text-slate-400">Plan Pro · 89&nbsp;€/mois</p>
            </div>
            <span className="flex-none rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">
              <span className="font-mono">82&nbsp;%</span> {t.atRisk}
            </span>
          </div>
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-slate-800 font-mono text-xs font-semibold text-slate-200">SB</span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold text-white">Studio Brume</p>
              <p className="font-mono text-[11px] text-slate-400">Plan Essentiel · 39&nbsp;€/mois</p>
            </div>
            <span className="flex-none rounded-full bg-brand-500 px-2.5 py-1 text-xs font-semibold text-slate-950">
              <span className="font-mono">54&nbsp;%</span> {t.watch}
            </span>
          </div>
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-slate-800 font-mono text-xs font-semibold text-slate-200">ML</span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold text-white">Maison Lumen</p>
              <p className="font-mono text-[11px] text-slate-400">Plan Pro · 89&nbsp;€/mois</p>
            </div>
            <span className="flex-none rounded-full bg-green-600 px-2.5 py-1 text-xs font-semibold text-slate-950">
              <span className="font-mono">12&nbsp;%</span> {t.stable}
            </span>
          </div>
        </div>

        <div className="mx-2.5 mb-2.5 flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-800 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-semibold text-white">Atelier Nuances</span>
            <span className="font-mono text-[13px] text-slate-400"><span className="font-semibold text-white">82</span> / 100</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full w-[82%] rounded-full bg-red-600" />
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10.5px] font-medium uppercase tracking-widest text-slate-400">{t.why}</span>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600/20 px-2.5 py-1 text-xs text-red-200">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />{t.reason1}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600/20 px-2.5 py-1 text-xs text-red-200">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />{t.reason2}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 rounded-lg border border-slate-700 bg-slate-900 p-3">
            <span className="text-xs text-slate-400">{t.emailSubject}</span>
            <span className="text-xs leading-relaxed text-slate-400">{t.emailPreview}</span>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-brand-500/35 bg-brand-500/10 px-3 py-2 text-[13px] font-semibold text-brand-400">
            <Check className="h-4 w-4" strokeWidth={2.5} />
            {t.emailReady}
          </span>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -right-10 -top-7 hidden w-52 items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/95 p-3 shadow-xl backdrop-blur sm:flex"
      >
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-brand-500/35 bg-brand-500/10 text-brand-400">
          <CreditCard className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-[13.5px] font-semibold text-white">{t.connected}</p>
          <p className="font-mono text-[11px] text-slate-400">{t.stripeReadOnly}</p>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2.4 }}
        className="absolute -left-36 top-36 hidden w-40 rounded-2xl border border-slate-700 bg-slate-800/95 p-3.5 shadow-xl backdrop-blur sm:block"
      >
        <p className="font-mono text-[10.5px] uppercase tracking-widest text-slate-400">{t.upTo}</p>
        <p className="flex items-baseline gap-1.5">
          <span className="font-mono text-[32px] font-medium leading-none tracking-tight text-brand-400">37</span>
          <span className="text-sm font-semibold text-white">{t.signalsWord}</span>
        </p>
        <p className="mt-1 text-xs leading-snug text-slate-400">{t.signalsNote}</p>
      </motion.div>

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
        className="absolute -bottom-6 -right-8 hidden w-48 items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/95 p-3 shadow-xl backdrop-blur sm:flex"
      >
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-brand-500/35 bg-brand-500/10 text-brand-400">
          <Check className="h-[18px] w-[18px]" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-[13.5px] font-semibold text-white">{t.readyToSend}</p>
          <p className="font-mono text-[11px] text-slate-400">{t.relanceFor} · Atelier Nuances</p>
        </div>
      </motion.div>
    </div>
  );
}

export default function AnimatedHero() {
  const t = useTranslations('home').hero;
  const tCall = useTranslations('callBooking');
  const [callModalOpen, setCallModalOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Léger parallax au scroll sur le mockup du dashboard (comme
  // data-parallax="hero-mockup" dans la maquette Claude Design) — le
  // visuel dérive un peu plus lentement que le reste de la page pendant
  // qu'on quitte le hero, plutôt que de défiler à l'identique.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const mockY = useTransform(scrollYProgress, [0, 1], [0, -60]);

  return (
    <>
      <section ref={sectionRef} className="relative overflow-hidden bg-gradient-to-b from-white via-white to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-10%] top-[10%] h-[400px] w-[400px] rounded-full bg-brand-200/20 blur-[120px] dark:bg-brand-500/10" />
          <div className="absolute right-[-5%] bottom-[5%] h-[300px] w-[300px] rounded-full bg-brand-100/30 blur-[100px] dark:bg-brand-500/10" />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-14 px-6 py-24 lg:flex-row lg:items-center lg:gap-12 lg:py-32">
          <div className="flex flex-col items-center gap-6 text-center lg:flex-[1.1] lg:items-start lg:text-left">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 font-mono text-xs font-medium uppercase tracking-widest text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              {t.badge}
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl"
            >
              {t.titleLine1}
              <br />
              {t.titleLine2}
              <br />
              {t.titleLine3Before}
              <span className="text-brand-600 dark:text-brand-400">{t.titleLine3Em}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-xl text-lg text-slate-600 dark:text-slate-400"
            >
              {t.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-3 lg:items-start"
            >
              <Link
                href="/signup"
                className="group flex w-full max-w-xl items-center gap-2.5 rounded-full border border-slate-200 bg-white p-2 pl-3 shadow-lg shadow-slate-900/5 transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20 dark:hover:border-brand-700"
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-slate-100 text-brand-600 dark:bg-slate-800 dark:text-brand-400">
                  <Plug className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] text-slate-400 dark:text-slate-500">
                  Connectez votre Stripe, ou importez un CSV…
                </span>
                <span className="flex flex-none items-center gap-2 rounded-full bg-gradient-to-b from-brand-500 to-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition group-hover:brightness-105 sm:px-6">
                  {t.cta} <ArrowRight className="h-4 w-4" />
                </span>
              </Link>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pl-1 lg:justify-start">
                <span className="text-xs text-slate-400 dark:text-slate-500">{t.ctaNote}</span>
                <button
                  onClick={() => setCallModalOpen(true)}
                  className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {tCall.button}
                </button>
              </div>
              <Link
                href="/demo?direct=1"
                className="text-sm font-medium text-slate-500 underline-offset-4 transition hover:text-brand-600 hover:underline dark:text-slate-400 dark:hover:text-brand-400"
              >
                {t.demoLink}
              </Link>
            </motion.div>

            <motion.ul
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-sm text-slate-500 dark:text-slate-400 lg:justify-start"
            >
              {t.trust.map((label, i) => {
                const Icon = TRUST_ICONS[i];
                return (
                  <li key={label} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-brand-500" strokeWidth={1.75} />
                    {label}
                  </li>
                );
              })}
            </motion.ul>
          </div>

          <motion.div style={{ y: mockY }} className="w-full lg:flex-1">
            <DashboardMock />
          </motion.div>
        </div>
      </section>

      {/* Hors de la section ci-dessus : celle-ci a overflow-hidden, ce qui
          clippait la modale (position: fixed) à sa hauteur — les clics sur
          le bas du formulaire tombaient alors sur le contenu de la page en
          dessous au lieu d'atteindre les boutons de la modale. */}
      <CallBookingModal open={callModalOpen} onClose={() => setCallModalOpen(false)} />
    </>
  );
}
