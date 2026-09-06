'use client';

import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// Absent des typings DOM par défaut de ce projet (lib cible plus ancienne)
// — l'API existe bel et bien dans les navigateurs qui la supportent, ce
// type local évite un `any` tout en restant sans risque sur ceux qui ne
// l'ont pas (startViewTransition est alors simplement undefined).
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  // Tant qu'une transition est en cours, un second clic ne doit rien
  // déclencher : lancer un nouveau startViewTransition alors que le
  // précédent n'est pas fini interrompt son animation en plein milieu —
  // visible comme un saut/glitch plutôt qu'une bascule fluide. Un ref plutôt
  // qu'un state : la valeur doit être à jour immédiatement à la lecture,
  // pas seulement après le prochain rendu.
  const isTransitioningRef = useRef(false);
  const { theme, setTheme } = useTheme();
  const { dict } = useLanguage();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />;
  }

  function handleToggle() {
    if (isTransitioningRef.current) return;
    const next = theme === 'dark' ? 'light' : 'dark';
    const doc = document as ViewTransitionDocument;
    // Sans ça, chaque élément de la page transitionne sa propre couleur en
    // même temps que la hero 3D continue de tourner en WebGL — visible
    // freeze. La View Transitions API anime deux captures figées de la
    // page (cercle qui s'ouvre, voir globals.css), un travail purement GPU
    // qui ne rivalise pas avec le rendu 3D en cours.
    if (!doc.startViewTransition) {
      setTheme(next);
      return;
    }

    // Le cercle démarre du centre de la hero 3D (le canvas de
    // AnimatedHero) quand elle est présente sur la page — sinon du centre
    // de l'écran. getBoundingClientRect() donne des coordonnées déjà
    // relatives au viewport, exactement ce qu'attend clip-path en px.
    const heroCanvas = document.querySelector('canvas');
    if (heroCanvas) {
      const rect = heroCanvas.getBoundingClientRect();
      document.documentElement.style.setProperty('--vt-x', `${rect.left + rect.width / 2}px`);
      document.documentElement.style.setProperty('--vt-y', `${rect.top + rect.height / 2}px`);
    } else {
      document.documentElement.style.setProperty('--vt-x', '50%');
      document.documentElement.style.setProperty('--vt-y', '50%');
    }

    isTransitioningRef.current = true;
    const transition = doc.startViewTransition(() => setTheme(next));
    transition.finished.finally(() => {
      isTransitioningRef.current = false;
    });
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
