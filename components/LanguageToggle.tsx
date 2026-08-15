'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function LanguageToggle() {
  const [mounted, setMounted] = useState(false);
  const { language, setLanguage, dict } = useLanguage();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-10 w-14 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />;
  }

  const next = language === 'fr' ? 'en' : 'fr';

  return (
    <motion.button
      type="button"
      onClick={() => setLanguage(next)}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={dict.common.languageToggle}
      className="flex h-10 items-center justify-center rounded-full px-3 text-sm font-semibold text-slate-600 transition-colors duration-200 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <motion.span
        key={language}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="tabular-nums"
      >
        {language.toUpperCase()}
      </motion.span>
    </motion.button>
  );
}
