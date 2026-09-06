'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// Absent des typings DOM par défaut de ce projet (lib cible plus ancienne)
// — l'API existe bel et bien dans les navigateurs qui la supportent, ce
// type local évite un `any` tout en restant sans risque sur ceux qui ne
// l'ont pas (startViewTransition est alors simplement undefined).
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { dict } = useLanguage();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />;
  }

  function handleToggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    const doc = document as ViewTransitionDocument;
    // Sans ça, chaque élément de la page transitionne sa propre couleur en
    // même temps que la hero 3D continue de tourner en WebGL — visible
    // freeze. La View Transitions API anime deux captures figées de la
    // page (cercle qui s'ouvre depuis le centre, voir globals.css), un
    // travail purement GPU qui ne rivalise pas avec le rendu 3D en cours.
    if (doc.startViewTransition) {
      doc.startViewTransition(() => setTheme(next));
    } else {
      setTheme(next);
    }
  }

  return (
    <motion.button
      type="button"
      onClick={handleToggle}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 hover:bg-slate-100 dark:hover:bg-slate-800"
      aria-label={dict.common.themeToggle}
    >
      <AnimatePresence mode="wait">
        {theme === 'dark' ? (
          <motion.div
            key="sun"
            initial={{ rotate: -90, opacity: 0, scale: 0.8 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Sun className="h-5 w-5 text-amber-400" strokeWidth={2} />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ rotate: -90, opacity: 0, scale: 0.8 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Moon className="h-5 w-5 text-slate-600" strokeWidth={2} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
