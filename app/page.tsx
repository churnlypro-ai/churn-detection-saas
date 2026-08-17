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
import { EASE_OUT } from '@/lib/animations';
import { useLanguage, useTranslations } from '@/lib/i18n/LanguageContext';
import { ShieldCheck, Zap, LineChart, ArrowRight, TrendingDown } from 'lucide-react';

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

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString(localeTag)}{suffix}
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
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: i * 0.15 }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="relative rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
            >
              <span className="absolute right-6 top-6 text-3xl font-extrabold text-slate-100 dark:text-slate-800">{step.step}</span>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <step.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{step.description}</p>
              {i < steps.length - 1 && (
                <div className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-slate-300 dark:text-slate-700 sm:block">
                  <ArrowRight className="h-5 w-5" />
                </div>
              )}
            </motion.div>
          ))}
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

function CTASection() {
  const ctaRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ctaRef, offset: ['start end', 'end start'] });
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1, 1.02]);
  const t = useTranslations('home').cta;

  return (
    <section ref={ctaRef} className="relative overflow-hidden bg-brand-600 px-6 py-28 text-center">
      <div className="no-theme-transition pointer-events-none absolute inset-0 opacity-10">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-32 w-32 rounded-full border-2 border-white"
            style={{ left: `${10 + i * 11}%`, top: `${20 + (i % 3) * 25}%` }}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE_OUT, delay: i * 0.1 }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
          />
        ))}
      </div>

      <motion.div style={{ scale }} className="relative mx-auto max-w-2xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="text-3xl font-bold text-white sm:text-5xl"
        >
          {t.title}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.15 }}
          className="mt-4 text-lg text-brand-100"
        >
          {t.body}
        </motion.p>
        <motion.a
          href="/signup"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.3 }}
          whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
          className="mt-10 inline-block rounded-full bg-white px-10 py-4 text-lg font-bold text-brand-700 shadow-2xl shadow-brand-900/30 transition"
        >
          {t.button}
        </motion.a>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-4 text-sm text-brand-200"
        >
          {t.note}
        </motion.p>
      </motion.div>
    </section>
  );
}

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(heroProgress, [0, 0.85], [1, 0.2]);
  const heroScale = useTransform(heroProgress, [0, 1], [1, 0.95]);
  const tToc = useTranslations('home').toc;
  const tFooter = useTranslations('home').footer;

  const TOC_ITEMS = [
    { id: 'constat', label: tToc.reality },
    { id: 'strategie', label: tToc.strategy },
    { id: 'tarif', label: tToc.pricing },
    { id: 'comment-ca-marche', label: tToc.howItWorks },
    { id: 'churn', label: tToc.churn },
    { id: 'cas-reels', label: tToc.caseStudies },
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

        <RealitySection />
        <SectionDivider />
        <StrategySection />
        <SectionDivider />

        <div id="tarif" className="relative bg-slate-50 dark:bg-slate-900">
          <Calculator />
        </div>
        <SectionDivider />

        <HowItWorksSection />
        <SectionDivider />
        <ChurnDefinitionSection />
        <SectionDivider />
        <CaseStudiesSection />
        <SectionDivider />
        <CTASection />
      </main>

      <footer className="relative border-t border-slate-100 bg-white py-10 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 dark:text-slate-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Churnly</span>
          <div className="flex gap-6">
            <Link href="/confidentialite" className="hover:text-slate-800 dark:hover:text-slate-300">{tFooter.privacy}</Link>
            <Link href="/conditions" className="hover:text-slate-800 dark:hover:text-slate-300">{tFooter.terms}</Link>
            <a href="mailto:contact@churnly.fr" className="hover:text-slate-800 dark:hover:text-slate-300">{tFooter.contact}</a>
          </div>
        </div>
      </footer>
    </>
  );
}
