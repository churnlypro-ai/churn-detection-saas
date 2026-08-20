'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, TrendingDown, CreditCard, AlertTriangle, Calendar, ArrowUpRight, Mail,
  UserCog, Euro, ShoppingCart, Rocket, History, Clock3, Ticket, RotateCcw, WifiOff, Frown,
  MailOpen, BellOff, ArrowDownRight, Undo2, ThumbsDown, HelpCircle, UserMinus, PhoneOff,
  Layers, Activity, RefreshCw, ExternalLink, Download, Timer, UserX, Smartphone, Receipt,
  Hourglass, Shuffle, Percent,
} from 'lucide-react';
import { EASE_OUT } from '@/lib/animations';
import { useTranslations } from '@/lib/i18n/LanguageContext';

const SIGNAL_ICONS = [
  WifiOff, TrendingDown, Mail, CreditCard, AlertTriangle, Frown, Calendar, ArrowUpRight, Clock, UserCog,
  Euro, ShoppingCart, Rocket, History, Clock3, Ticket, RotateCcw, MailOpen, BellOff, ArrowDownRight,
  Undo2, ThumbsDown, HelpCircle, UserMinus, PhoneOff, Layers, Activity, RefreshCw, ExternalLink, Download,
  Timer, UserX, Smartphone, Receipt, Hourglass, Shuffle, Percent,
];

// px/s en défilement libre — volontairement lent, la bande sert de fond
// discret, pas d'élément qu'on doit "suivre".
const AUTOPLAY_SPEED = 14;

export default function SignalMarquee() {
  const [selected, setSelected] = useState<number | null>(null);
  const t = useTranslations('signals');
  const SIGNALS = t.items.map((item, i) => ({ ...item, icon: SIGNAL_ICONS[i] }));

  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const directionRef = useRef(-1); // -1 = défile vers la gauche (défaut), 1 = vers la droite
  const pausedRef = useRef(false);
  const lastScrollYRef = useRef(0);

  // Le sens du défilement libre s'inverse selon le sens du scroll de page —
  // scroller vers le bas garde le sens par défaut (gauche), remonter
  // l'inverse (droite). Neutre tant qu'on ne scrolle pas.
  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastScrollYRef.current;
      if (Math.abs(delta) > 2) {
        directionRef.current = delta > 0 ? -1 : 1;
        lastScrollYRef.current = y;
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let last = performance.now();
    let raf = 0;

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      if (!pausedRef.current && track) {
        const halfWidth = track.scrollWidth / 2;
        posRef.current += directionRef.current * AUTOPLAY_SPEED * dt;
        // La liste est dupliquée (2x SIGNALS) : à mi-parcours dans un sens
        // ou dans l'autre, on revient exactement au même visuel, donc le
        // saut est invisible.
        if (posRef.current <= -halfWidth) posRef.current += halfWidth;
        if (posRef.current > 0) posRef.current -= halfWidth;
        track.style.transform = `translateX(${posRef.current}px)`;
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div>
      <div
        className="relative overflow-hidden"
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent dark:from-slate-950 sm:w-32" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent dark:from-slate-950 sm:w-32" />

        <div ref={trackRef} className="flex w-max gap-4 will-change-transform">
          {[...SIGNALS, ...SIGNALS].map((signal, i) => {
            const originalIndex = i % SIGNALS.length;
            const isActive = selected === originalIndex;
            return (
              <button
                key={i}
                onClick={() => setSelected(isActive ? null : originalIndex)}
                className={`flex flex-shrink-0 items-center gap-2.5 rounded-2xl border px-5 py-3.5 text-left transition ${
                  isActive
                    ? 'border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-500/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <signal.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className={`whitespace-nowrap text-sm font-medium ${isActive ? 'text-brand-700 dark:text-brand-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {signal.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selected !== null ? (
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="mx-auto mt-8 max-w-xl rounded-2xl border border-brand-100 bg-brand-50/50 p-6 text-center dark:border-brand-800/40 dark:bg-brand-500/5"
          >
            <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">{SIGNALS[selected].label}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{SIGNALS[selected].detail}</p>
          </motion.div>
        ) : (
          <motion.p
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-8 text-center text-sm text-slate-400 dark:text-slate-500"
          >
            {t.clickHint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
