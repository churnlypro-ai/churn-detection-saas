'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useCookieConsent } from '@/lib/cookieConsent';
import { useTranslations } from '@/lib/i18n/LanguageContext';

// N'affiche rien tant que consent === null n'est pas confirmé après
// hydratation (voir CookieConsentProvider) — évite un flash du bandeau sur
// un visiteur qui a déjà répondu, le temps que localStorage soit lu.
export default function CookieConsentBanner() {
  const { consent, accept, reject } = useCookieConsent();
  const t = useTranslations('common').cookieConsent;

  return (
    <AnimatePresence>
      {consent === null && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-x-0 bottom-0 z-[100] border-t border-slate-200 bg-white/95 px-6 py-4 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95"
        >
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {t.text}{' '}
              <Link href="/politique-cookies" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                {t.learnMore}
              </Link>
            </p>
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                onClick={reject}
                className="whitespace-nowrap rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t.reject}
              </button>
              <button
                onClick={accept}
                className="whitespace-nowrap rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 dark:hover:bg-brand-500"
              >
                {t.accept}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
