'use client';

import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import AnimatedHero from '@/components/AnimatedHero';
import Calculator from '@/components/Calculator';
import SectionDivider from '@/components/SectionDivider';
import SectionToc from '@/components/SectionToc';
import SignalMarquee from '@/components/SignalMarquee';
import FadeLine from '@/components/FadeLine';
import { CallBookingModal } from '@/components/CallBookingModal';
import { EASE_OUT } from '@/lib/animations';
import { useLanguage, useTranslations } from '@/lib/i18n/LanguageContext';
import { ShieldCheck, Zap, LineChart, ArrowRight, TrendingDown, PhoneCall, Quote, Star, Volume2, VolumeX, Play, Pause, Check, Minus, X, Plus, CreditCard, Trash2, Mail, Download, Calendar, Users, Gift } from 'lucide-react';

const reveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.6, ease: EASE_OUT },
} as const;

const REALITY_STAT_VALUES = [
  { value: 90, suffix: '%' },
  { value: 60000, prefix: '€', suffix: '/an' },
  { value: 5, suffix: 'x' },
];

function CountUp({ end, duration = 1.5, prefix = '', suffix = '' }: { end: number; duration?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [count, setCount] = useState(0);
  const { localeTag } = useLanguage();

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.round(eased * end);
      setCount(start);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, end, duration]);

  // Le compteur part de 0 et n'anime qu'après hydratation côté client (voir
  // useEffect ci-dessus) — le HTML rendu côté serveur, lui, ne contient donc
  // que "0" tant que le JS n'a pas tourné. Invisible pour un visiteur normal
  // (l'animation est quasi instantanée), mais un crawler ou un outil qui ne
  // fait que lire le HTML brut (moteur de recherche, résumé IA, `curl`) voit
  // littéralement "0%" au lieu de "90%" — la vraie statistique disparaît de
  // ce que ces outils indexent. Le span visible (animé) reste inchangé pour
  // l'œil, mais un second span sr-only porte toujours la valeur finale
  // réelle, présente dans le HTML dès le premier rendu serveur.
  return (
    <span ref={ref}>
      <span aria-hidden="true">{prefix}{count.toLocaleString(localeTag)}{suffix}</span>
      <span className="sr-only">{prefix}{end.toLocaleString(localeTag)}{suffix}</span>
    </span>
  );
}

function RealitySection() {
  const pulseRef = useRef<HTMLDivElement>(null);
  const pulseInView = useInView(pulseRef, { once: false, amount: 0.1 });
  const t = useTranslations('home').reality;

  return (
    <section id="constat" className="relative overflow-hidden bg-gradient-to-b from-white to-brand-50/30 px-6 py-28 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-4xl">
        <motion.p {...reveal} className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
          {t.eyebrow}
        </motion.p>
        <motion.h2 {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }} className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {t.title}
        </motion.h2>
        <motion.p {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.2 }} className="mt-6 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
          {t.body}
        </motion.p>

        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {REALITY_STAT_VALUES.map((stat, i) => (
            <motion.div
              key={t.statLabels[i]}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: i * 0.2 }}
              className="text-center"
            >
              <p className="text-4xl font-extrabold text-brand-600 dark:text-brand-400 sm:text-5xl">
                <CountUp end={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
              </p>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-500">{t.statLabels[i]}</p>
            </motion.div>
          ))}
        </div>

        <div ref={pulseRef} className="no-theme-transition relative mt-20 h-32">
          {pulseInView && Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-16 w-16 rounded-full border border-brand-200 bg-brand-50/50 dark:border-brand-800/40 dark:bg-brand-500/10"
              style={{ left: `${(i / 12) * 100}%`, top: `${Math.sin(i) * 20}px` }}
              initial={{ opacity: 0.6 }}
              animate={{ opacity: [0.6, 0.05, 0.6] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// Vidéo hook (problème → solution Churnly, voix off + motion design)
// placée juste au-dessus de RealitySection ("La réalité opérationnelle")
// — muette par défaut à l'arrivée sur la page (requis pour que les
// navigateurs autorisent l'autoplay), avec un bouton pour activer le son
// manuellement, même pattern que les vidéos hero autoplay muettes vues
// ailleurs (ex: insyder.io).
// Deux exports distincts, recomposés par Cowork (pas juste croppés l'un
// de l'autre) : hook-9x16.mp4 pour mobile, hook-16x9.mp4 pour desktop —
// voir la discussion du 02/10. On ne rend qu'une seule balise <video> à
// la fois (jamais les deux en parallèle) pour ne pas télécharger et
// autoplayer deux fichiers vidéo simultanément.
function HookVideoSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  // false par défaut (plutôt que null) pour un rendu SSR cohérent avec le
  // premier rendu client avant que matchMedia ne soit évalué — corrigé
  // quasi immédiatement au montage, léger flash possible sur desktop au
  // tout premier chargement, acceptable ici.
  const [isDesktop, setIsDesktop] = useState(false);
  // Distingue une pause manuelle (bouton/clic) d'une pause automatique
  // liée au scroll — seule la première doit empêcher la reprise
  // automatique quand la vidéo revient dans le viewport. Le son (muted
  // + soundOn) n'est jamais touché par ce mécanisme : si l'utilisateur
  // l'a activé, il reste activé même après une sortie/retour de champ.
  const manuallyPausedRef = useRef(false);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mql.matches);
    function handleChange(e: MediaQueryListEvent) {
      setIsDesktop(e.matches);
      setSoundOn(false);
      manuallyPausedRef.current = false;
    }
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  const src = isDesktop ? '/videos/hook-16x9.mp4' : '/videos/hook-9x16.mp4';

  // Remise en pause dès que la vidéo sort du viewport (scroll trop bas ou
  // retour trop haut) — l'utilisateur est passé à autre chose. Reprend
  // automatiquement si elle revient dans le viewport, sauf si la pause
  // précédente était volontaire (bouton/clic).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          if (!video.paused) video.pause();
        } else if (video.paused && !manuallyPausedRef.current) {
          video.play();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [src]);

  function toggleSound() {
    const video = videoRef.current;
    if (!video) return;
    const next = !soundOn;
    video.muted = !next;
    setSoundOn(next);
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      manuallyPausedRef.current = false;
      video.play();
    } else {
      manuallyPausedRef.current = true;
      video.pause();
    }
  }

  return (
    <section className="relative overflow-hidden bg-white px-6 py-20 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl">
        <motion.div
          {...reveal}
          className={`relative mx-auto overflow-hidden rounded-3xl border border-slate-100 bg-slate-950 shadow-xl dark:border-slate-800 ${
            isDesktop ? 'w-full' : 'w-full max-w-xs'
          }`}
        >
          <video
            key={src}
            ref={videoRef}
            className={`block w-full cursor-pointer object-cover ${isDesktop ? 'aspect-video' : 'aspect-[9/16]'}`}
            src={src}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            onClick={togglePlay}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Mettre en pause' : 'Reprendre la lecture'}
            className="absolute bottom-4 left-4 inline-flex items-center justify-center rounded-full bg-black/60 p-2 text-white backdrop-blur transition hover:bg-black/75"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundOn ? 'Couper le son' : 'Activer le son'}
            className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/75"
          >
            {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {soundOn ? 'Couper le son' : 'Activer le son'}
          </button>
        </motion.div>
      </div>
    </section>
  );
}

function StrategySection() {
  const shieldRef = useRef<HTMLDivElement>(null);
  const shieldInView = useInView(shieldRef, { once: false, amount: 0.3 });
  const t = useTranslations('home').strategy;

  return (
    <section id="strategie" className="relative overflow-hidden bg-white px-6 py-28 dark:bg-slate-950">
      <div className="mx-auto max-w-4xl">
        <motion.p {...reveal} className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
          {t.eyebrow}
        </motion.p>
        <motion.h2 {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }} className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {t.title}
        </motion.h2>
        <motion.p {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.2 }} className="mt-6 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
          {t.body}
        </motion.p>

        <div className="relative mt-16 flex items-center justify-center gap-8 py-12">
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, ease: EASE_OUT }}
            className="flex flex-col items-center gap-3"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              <TrendingDown className="h-8 w-8" />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t.acquisitionLabel}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{t.acquisitionSub}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.4 }}
            className="flex flex-col items-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <ArrowRight className="h-6 w-6" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.2 }}
            className="flex flex-col items-center gap-3"
          >
            <motion.div
              ref={shieldRef}
              animate={shieldInView ? { boxShadow: ['0 0 0 0 rgba(217,119,6,0.2)', '0 0 0 12px rgba(217,119,6,0)'] } : undefined}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
            >
              <ShieldCheck className="h-8 w-8" />
            </motion.div>
            <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">{t.retentionLabel}</p>
            <p className="text-xs text-brand-500 dark:text-brand-500">{t.retentionSub}</p>
          </motion.div>
        </div>

        <motion.div {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.3 }} className="mt-8 rounded-2xl border border-brand-100 bg-brand-50/50 p-6 text-center dark:border-brand-800/40 dark:bg-brand-500/5">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {t.calloutTitle}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {t.calloutBody}
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// Tableau comparatif Churnly vs solutions classiques / tableurs — par
// catégorie d'outils, jamais un concurrent nommé (voir le disclaimer en
// pied de tableau). Les 4 lignes reprennent des faits réels du produit
// (37 signaux, import Stripe/CSV, email de relance rédigé, tarif public
// aligné sur le CA) plutôt que des chiffres de performance inventés.
function ComparatifSection() {
  const t = useTranslations('home').comparatif;

  return (
    <section id="comparatif" className="relative bg-white px-6 py-28 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl">
        <motion.p {...reveal} className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
          {t.eyebrow}
        </motion.p>
        <motion.h2 {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }} className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {t.title}
        </motion.h2>
        <motion.p {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.2 }} className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
          {t.subtitle}
        </motion.p>

        <motion.div {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.3 }} className="mt-12 overflow-x-auto rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">{t.title}</caption>
            <thead>
              <tr>
                <th scope="col" className="w-2/5 px-6 py-5 text-left align-bottom" />
                <th scope="col" className="border-x border-brand-200/60 bg-brand-50 px-4 py-5 text-center align-bottom dark:border-brand-800/40 dark:bg-brand-500/10">
                  <span className="block text-lg font-bold tracking-tight text-slate-900 dark:text-white">Churnly</span>
                </th>
                <th scope="col" className="px-4 py-5 text-center align-bottom font-normal">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">{t.columns.classicLabel}</span>
                  <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">{t.columns.classicSub}</span>
                </th>
                <th scope="col" className="px-4 py-5 text-center align-bottom font-normal">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">{t.columns.sheetsLabel}</span>
                  <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">{t.columns.sheetsSub}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((row) => (
                <tr key={row.criterion} className="border-t border-slate-100 dark:border-slate-800">
                  <th scope="row" className="px-6 py-5 text-left align-middle font-normal">
                    <span className="block text-[15px] font-semibold text-slate-900 dark:text-white">{row.criterion}</span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-500">{row.detail}</span>
                  </th>
                  <td className="border-x border-brand-200/60 bg-brand-50/60 px-4 py-5 text-center align-middle dark:border-brand-800/40 dark:bg-brand-500/5">
                    <span className="inline-flex flex-col items-center gap-1.5">
                      <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" strokeWidth={3} />
                      <span className="text-xs font-medium text-slate-900 dark:text-white">{row.churnly}</span>
                    </span>
                  </td>
                  <td className="px-4 py-5 text-center align-middle">
                    <span className="inline-flex flex-col items-center gap-1.5">
                      <Minus className="h-4 w-4 text-slate-400 dark:text-slate-600" />
                      <span className="text-xs text-slate-500 dark:text-slate-500">{row.classic}</span>
                    </span>
                  </td>
                  <td className="px-4 py-5 text-center align-middle">
                    <span className="inline-flex flex-col items-center gap-1.5">
                      <X className="h-4 w-4 text-slate-400 dark:text-slate-600" />
                      <span className="text-xs text-slate-500 dark:text-slate-500">{row.sheets}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
        <motion.p {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.4 }} className="mt-4 text-xs text-slate-400 dark:text-slate-500">
          {t.footnote}
        </motion.p>
      </div>
    </section>
  );
}

const FEATURE_ICONS = [LineChart, Mail, Download, Calendar, Users, Zap];

// Grille de fonctionnalités + bandeau Haiku/Opus (quel modèle Claude tourne
// selon l'essai gratuit ou l'abonnement — voir lib/claude.ts MODEL_BY_TIER).
function FeaturesSection() {
  const t = useTranslations('home').features;

  return (
    <section id="fonctionnalites" className="relative bg-slate-50 px-6 py-28 dark:bg-slate-900">
      <div className="mx-auto max-w-5xl">
        <motion.p {...reveal} className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
          {t.eyebrow}
        </motion.p>
        <motion.h2 {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }} className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {t.title} <span className="text-slate-400 dark:text-slate-500">{t.titleRest}</span>
        </motion.h2>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {t.items.map((item, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, ease: EASE_OUT, delay: (i % 3) * 0.1 }}
                className="flex flex-col gap-3.5 rounded-2xl border border-slate-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">{item.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.description}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          {...reveal}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.2 }}
          className="mt-8 flex flex-wrap items-center gap-10 rounded-3xl border border-slate-100 bg-white p-8 dark:border-slate-800 dark:bg-slate-950 sm:p-10"
        >
          <div className="flex min-w-[260px] flex-1 flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">{t.aiSplit.eyebrow}</span>
            <h3 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 dark:text-white">
              {t.aiSplit.title} <span className="text-slate-400 dark:text-slate-500">{t.aiSplit.titleRest}</span>
            </h3>
          </div>
          <div className="grid flex-[1.3] grid-cols-1 gap-4 sm:min-w-[320px] sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
              <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">{t.aiSplit.free.label}</span>
              <span className="font-mono text-lg font-medium tracking-tight text-slate-900 dark:text-white">{t.aiSplit.free.model}</span>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t.aiSplit.free.body}</p>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-500/35 dark:bg-brand-500/10">
              <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-brand-700 dark:text-brand-400">{t.aiSplit.paid.label}</span>
              <span className="font-mono text-lg font-medium tracking-tight text-slate-900 dark:text-white">{t.aiSplit.paid.model}</span>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{t.aiSplit.paid.body}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ReferralCallout() {
  const t = useTranslations('home').referralCallout;

  return (
    <motion.div
      {...reveal}
      className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 sm:p-6"
    >
      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
        <Gift className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <p className="flex-1 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
        <span className="font-semibold text-slate-900 dark:text-white">{t.title}. </span>
        {t.body}
      </p>
    </motion.div>
  );
}

const STEP_ICONS = [Zap, LineChart, ShieldCheck];

function HowItWorksSection() {
  const t = useTranslations('home').howItWorks;
  const steps = t.steps.map((step, i) => ({ ...step, icon: STEP_ICONS[i], step: String(i + 1).padStart(2, '0') }));

  return (
    <section id="comment-ca-marche" className="relative bg-slate-50 px-6 py-28 dark:bg-slate-900">
      <div className="mx-auto max-w-5xl">
        <motion.h2 {...reveal} className="mb-4 text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {t.title}
        </motion.h2>
        <motion.p {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }} className="mb-16 text-center text-slate-600 dark:text-slate-400">
          {t.subtitle}
        </motion.p>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {steps.map((step, i) => {
            const isAction = i === steps.length - 1;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, ease: EASE_OUT, delay: i * 0.15 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className={`relative rounded-3xl p-8 shadow-sm transition-shadow hover:shadow-md ${
                  isAction
                    ? 'border-2 border-brand-200 bg-brand-50/50 dark:border-brand-700/60 dark:bg-brand-500/5'
                    : 'border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950'
                }`}
              >
                <span className={`absolute right-6 top-6 text-3xl font-extrabold ${isAction ? 'text-brand-100 dark:text-brand-800/60' : 'text-slate-100 dark:text-slate-800'}`}>{step.step}</span>
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-full ${isAction ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400' : 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'}`}>
                  <step.icon className="h-6 w-6" />
                </div>
                <h3 className={`text-lg font-semibold ${isAction ? 'text-brand-800 dark:text-brand-400' : 'text-slate-900 dark:text-white'}`}>{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{step.description}</p>
                {i < steps.length - 1 && (
                  <div className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-slate-300 dark:text-slate-700 sm:block">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.3 }} className="mt-20">
          <p className="mb-8 text-center text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
            {t.signalsLabel}
          </p>
          <SignalMarquee />
        </motion.div>
      </div>
    </section>
  );
}

function ChurnDefinitionSection() {
  const flowRef = useRef<HTMLDivElement>(null);
  // once:true — avec le délai en cascade ci-dessous, remonter les points à
  // chaque passage dans le viewport (once:false) rendait l'encadré vide
  // plusieurs secondes à chaque fois qu'on le recroisait en scrollant.
  const flowInView = useInView(flowRef, { once: true, amount: 0.1 });
  const t = useTranslations('home').churnDefinition;

  return (
    <section id="churn" className="relative overflow-hidden bg-white px-6 py-28 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl">
        <motion.h2 {...reveal} className="text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {t.title}
        </motion.h2>
        <motion.p {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }} className="mt-6 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
          {t.body1}
        </motion.p>
        <motion.p {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.2 }} className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
          {t.body2Before}<em>{t.body2Em}</em>{t.body2After}
        </motion.p>

        <div ref={flowRef} className="relative mt-16 h-40 overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-900">
          <div className="no-theme-transition absolute left-0 top-0 flex h-full w-full items-center">
            {flowInView && Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={`in-${i}`}
                className="absolute h-8 w-8 rounded-full bg-brand-200 dark:bg-brand-500/30"
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 800, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: i * 0.15, ease: 'linear' }}
                style={{ top: `${20 + (i % 3) * 30}px` }}
              />
            ))}
            {flowInView && Array.from({ length: 15 }).map((_, i) => (
              <motion.div
                key={`out-${i}`}
                className="absolute h-8 w-8 rounded-full border-2 border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/40"
                initial={{ x: 800, opacity: 0 }}
                animate={{ x: -50, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 5, repeat: Infinity, delay: i * 0.18 + 0.3, ease: 'linear' }}
                style={{ top: `${40 + (i % 3) * 30}px` }}
              />
            ))}
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t.flowLabel}</p>
          </div>
        </div>

        <motion.div {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.3 }} className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.ignoredTitle}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t.ignoredBody}</p>
          </div>
          <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-6 dark:border-brand-800/40 dark:bg-brand-500/5">
            <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">{t.withChurnlyTitle}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t.withChurnlyBody}</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const CASE_RESULTS = [
  { result: 50000, delay: 0 },
  { result: 7, delay: 0.2 },
  { result: 32000, delay: 0.4 },
];

function CaseStudiesSection() {
  const t = useTranslations('home').caseStudies;
  const cases = t.cases.map((c, i) => ({ ...c, ...CASE_RESULTS[i] }));

  return (
    <section id="cas-reels" className="relative bg-slate-50 px-6 py-28 dark:bg-slate-900">
      <div className="mx-auto max-w-5xl">
        <motion.h2 {...reveal} className="mb-16 text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {t.title}
        </motion.h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {cases.map((c, i) => (
            <motion.div
              key={c.company}
              initial={{ opacity: 0, x: i % 2 === 0 ? -32 : 32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: c.delay }}
              whileHover={{ y: -6, rotateY: 4, transition: { duration: 0.2 } }}
              style={{ perspective: 1000 }}
              className="flex flex-col rounded-3xl border border-slate-100 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{c.company}</p>
              <p className="mt-4 text-4xl font-extrabold text-brand-600 dark:text-brand-400">
                <CountUp end={c.result} prefix={c.result > 1000 ? '€' : ''} suffix={c.result > 1000 ? '' : '%'} />
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-500">{c.unit}</p>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{c.description}</p>
              <div className="mt-6 rounded-full bg-brand-50 px-3 py-1.5 text-center text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                {c.metric}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface Testimonial {
  id: string;
  author_name: string;
  company_name: string | null;
  role_title: string | null;
  rating: number;
  content: string;
}

// Bande défilante horizontale, même mécanique que SignalMarquee
// (components/SignalMarquee.tsx) — translateX en boucle sur une liste
// dupliquée, pause au survol — mais ici chaque carte est un lien vers
// /avis plutôt qu'un détail qui s'ouvre sur place : un avis complet mérite
// sa propre page, pas un extrait replié.
function TestimonialsMarquee({ items }: { items: Testimonial[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const pausedRef = useRef(false);
  const visibleRef = useRef(true);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let last = performance.now();
    let raf = 0;
    const SPEED = 26; // px/s — lent, la bande est un fond qu'on parcourt, pas un carrousel à suivre

    const intersectionObserver = new IntersectionObserver(
      (entries) => { visibleRef.current = entries[0]?.isIntersecting ?? true; },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(track);

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      if (!pausedRef.current && visibleRef.current && track) {
        const halfWidth = track.scrollWidth / 2;
        posRef.current -= SPEED * dt;
        // Liste dupliquée (2x items) : à mi-parcours, on revient exactement
        // au même visuel, donc la boucle est invisible.
        if (posRef.current <= -halfWidth) posRef.current += halfWidth;
        track.style.transform = `translateX(${posRef.current}px)`;
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      intersectionObserver.disconnect();
    };
  }, []);

  return (
    <div
      className="relative mt-16 overflow-hidden"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-900 sm:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-slate-50 to-transparent dark:from-slate-900 sm:w-32" />

      <div ref={trackRef} className="flex w-max gap-6 will-change-transform">
        {[...items, ...items].map((item, i) => (
          <Link key={`${item.id}-${i}`} href="/avis" className="block w-80 flex-shrink-0">
            <TestimonialCard item={item} i={i} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function TestimonialCard({ item, i }: { item: Testimonial; i: number }) {
  const initial = item.author_name.trim().charAt(0).toUpperCase() || '?';
  const subtitle = [item.role_title, item.company_name].filter(Boolean).join(' · ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay: (i % 3) * 0.12 }}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className="relative flex h-full flex-col rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-950"
    >
      <Quote className="h-8 w-8 text-brand-100 dark:text-brand-900" strokeWidth={2.5} />
      <div className="mt-3 flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, s) => (
          <Star
            key={s}
            className={`h-3.5 w-3.5 ${s < item.rating ? 'fill-brand-500 text-brand-500 dark:fill-brand-400 dark:text-brand-400' : 'text-slate-200 dark:text-slate-800'}`}
          />
        ))}
      </div>
      <p className="mt-4 flex-1 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
        &ldquo;{item.content}&rdquo;
      </p>
      <div className="mt-6 flex items-center gap-3 border-t border-slate-50 pt-5 dark:border-slate-900">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white dark:from-brand-400 dark:to-brand-600">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.author_name}</p>
          {subtitle && <p className="truncate text-xs text-slate-500 dark:text-slate-500">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
  );
}

function TestimonialsSection({ items }: { items: Testimonial[] }) {
  const t = useTranslations('home').testimonials;
  const avg = items.reduce((sum, it) => sum + it.rating, 0) / items.length;

  return (
    <section id="avis" className="relative overflow-hidden bg-slate-50 px-6 py-28 dark:bg-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <motion.p {...reveal} className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
            {t.eyebrow}
          </motion.p>
          <motion.h2 {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }} className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            {t.title}
          </motion.h2>
          <motion.p {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.2 }} className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            {t.subtitle}
          </motion.p>
          <motion.div
            {...reveal}
            transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.3 }}
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm dark:bg-slate-950 dark:text-slate-200"
          >
            <Star className="h-4 w-4 fill-brand-500 text-brand-500 dark:fill-brand-400 dark:text-brand-400" />
            {t.ratingSummary(avg.toFixed(1), items.length)}
          </motion.div>
        </div>

        <TestimonialsMarquee items={items} />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.2 }}
          className="mt-12 text-center"
        >
          <Link
            href="/avis"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-brand-700"
          >
            <Star className="h-4 w-4" />
            {t.addReviewCta}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

const SECURITY_ICONS = [CreditCard, ShieldCheck, Trash2];

// FAQ + bloc sécurité — contenu volontairement plus court que le FAQ complet
// de /pricing (déjà très détaillé sur les plans Standard/Performance) :
// ici on reste sur les questions générales qu'un visiteur se pose avant de
// s'inscrire, pas la tarification en détail.
function FaqSection() {
  const t = useTranslations('home').faqSection;

  return (
    <section id="faq" className="relative bg-slate-50 px-6 py-28 dark:bg-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-12 lg:flex-row lg:gap-16">
        <div className="flex flex-col gap-8 lg:flex-1">
          <div>
            <motion.p {...reveal} className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
              {t.eyebrow}
            </motion.p>
            <motion.h2 {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }} className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              {t.title}
            </motion.h2>
          </div>
          <motion.div {...reveal} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.2 }} className="flex flex-col gap-5 rounded-3xl border border-slate-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t.securityLabel}</span>
            {t.securityItems.map((item, i) => {
              const Icon = SECURITY_ICONS[i];
              return (
                <div key={item.title} className="flex gap-3">
                  <Icon className="h-[18px] w-[18px] flex-none text-brand-600 dark:text-brand-400" strokeWidth={1.75} />
                  <div>
                    <p className="text-[15px] font-semibold text-slate-900 dark:text-white">{item.title}</p>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.body}</p>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>

        <div className="flex flex-col border-t border-slate-200 dark:border-slate-800 lg:flex-[2]">
          {t.items.map((item, i) => (
            <motion.details
              key={item.q}
              {...reveal}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: Math.min(i * 0.06, 0.3) }}
              className="group border-b border-slate-200 py-2 dark:border-slate-800"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-[17px] font-semibold text-slate-900 [&::-webkit-details-marker]:hidden dark:text-white">
                {item.q}
                <Plus className="h-5 w-5 flex-none text-brand-600 transition-transform duration-200 group-open:rotate-45 dark:text-brand-400" />
              </summary>
              <p className="pb-4 pr-8 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{item.a}</p>
            </motion.details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  const ctaRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ctaRef, offset: ['start end', 'end start'] });
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1, 1.02]);
  const t = useTranslations('home').cta;
  const tCall = useTranslations('callBooking');
  const [callModalOpen, setCallModalOpen] = useState(false);

  return (
    <>
    <section ref={ctaRef} className="relative overflow-hidden bg-gradient-to-b from-white to-brand-50/40 px-6 py-28 text-center dark:from-slate-950 dark:to-slate-900">
      <motion.div style={{ scale }} className="relative mx-auto max-w-2xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl"
        >
          {t.title}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.15 }}
          className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400"
        >
          {t.body}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.3 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <motion.a
            href="/signup"
            whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.98 }}
            className="inline-block rounded-full bg-brand-600 px-10 py-4 text-lg font-bold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 dark:hover:bg-brand-500"
          >
            {t.button}
          </motion.a>
          <motion.button
            onClick={() => setCallModalOpen(true)}
            whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-8 py-4 text-lg font-bold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-700"
          >
            <PhoneCall className="h-4 w-4" />
            {tCall.button}
          </motion.button>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-4 text-sm text-slate-400 dark:text-slate-500"
        >
          {t.note}
        </motion.p>
      </motion.div>
    </section>

    {/* Hors de la section ci-dessus (overflow-hidden) : voir la même
        correction et son explication dans AnimatedHero.tsx. */}
    <CallBookingModal open={callModalOpen} onClose={() => setCallModalOpen(false)} />
    </>
  );
}

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(heroProgress, [0, 0.85], [1, 0.2]);
  const heroScale = useTransform(heroProgress, [0, 1], [1, 0.95]);
  const tToc = useTranslations('home').toc;
  const tFooter = useTranslations('home').footer;

  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  useEffect(() => {
    fetch('/api/testimonials')
      .then((r) => (r.ok ? r.json() : { testimonials: [] }))
      .then((result) => setTestimonials(result.testimonials ?? []))
      .catch(() => setTestimonials([]));
  }, []);

  const TOC_ITEMS = [
    { id: 'constat', label: tToc.reality },
    { id: 'churn', label: tToc.churn },
    { id: 'strategie', label: tToc.strategy },
    { id: 'comparatif', label: tToc.comparatif },
    { id: 'fonctionnalites', label: tToc.features },
    { id: 'tarif', label: tToc.pricing },
    { id: 'comment-ca-marche', label: tToc.howItWorks },
    { id: 'cas-reels', label: tToc.caseStudies },
    { id: 'faq', label: tToc.faq },
    ...(testimonials.length > 0 ? [{ id: 'avis', label: tToc.testimonials }] : []),
  ];

  return (
    <>
      <Navigation user={null} />
      <SectionToc items={TOC_ITEMS} />
      <main className="relative">
        <motion.div ref={heroRef} style={{ opacity: heroOpacity, scale: heroScale }} className="relative">
          <AnimatedHero />
        </motion.div>

        <SectionDivider />

        <HookVideoSection />
        <SectionDivider />

        <RealitySection />
        <SectionDivider />
        <ChurnDefinitionSection />
        <SectionDivider />
        <StrategySection />
        <SectionDivider />

        <ComparatifSection />
        <SectionDivider />

        <FeaturesSection />
        <SectionDivider />

        <div id="tarif" className="relative bg-slate-50 dark:bg-slate-900">
          <Calculator />
          <div className="mx-auto max-w-5xl px-6 pb-20">
            <ReferralCallout />
          </div>
        </div>
        <SectionDivider />

        <HowItWorksSection />
        <SectionDivider />
        <CaseStudiesSection />
        <SectionDivider />
        <FaqSection />
        <SectionDivider />
        <CTASection />
        {testimonials.length > 0 && (
          <>
            <SectionDivider />
            <TestimonialsSection items={testimonials} />
          </>
        )}
      </main>

      <footer className="relative bg-white py-14 dark:bg-slate-950">
        <FadeLine className="top-0" />
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6">
          <div className="flex flex-wrap justify-between gap-10">
            <div className="flex max-w-sm flex-col gap-3">
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Churnly</span>
              <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-500">{tFooter.tagline}</p>
            </div>
            <div className="flex flex-wrap gap-12">
              <nav aria-label={tFooter.productLabel} className="flex flex-col gap-1">
                <span className="pb-2 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tFooter.productLabel}</span>
                <a href="#fonctionnalites" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tToc.features}</a>
                <a href="#comment-ca-marche" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tToc.howItWorks}</a>
                <a href="#tarif" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tToc.pricing}</a>
                <a href="#faq" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tToc.faq}</a>
              </nav>
              <nav aria-label={tFooter.legalLabel} className="flex flex-col gap-1">
                <span className="pb-2 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tFooter.legalLabel}</span>
                <Link href="/confidentialite" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tFooter.privacy}</Link>
                <Link href="/conditions" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tFooter.terms}</Link>
                <Link href="/politique-cookies" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tFooter.cookies}</Link>
                <Link href="/remboursement" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tFooter.refund}</Link>
                <Link href="/mentions-legales" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tFooter.legalNotice}</Link>
                <a href="mailto:contact@churnly.fr" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tFooter.contact}</a>
              </nav>
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-6 text-sm text-slate-400 dark:border-slate-900 dark:text-slate-500">
            <span>© {new Date().getFullYear()} Churnly</span>
            <span>{tFooter.poweredBy}</span>
          </div>
        </div>
      </footer>
    </>
  );
}
