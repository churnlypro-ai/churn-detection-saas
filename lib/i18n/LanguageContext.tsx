'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { dictionaries, isLocale, type Locale } from './index';
import type { Dictionary } from './dictionaries/fr';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'language-preference';

type LanguageContextValue = {
  language: Locale;
  setLanguage: (lang: Locale) => void;
  dict: Dictionary;
  localeTag: string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Locale>('fr');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) {
      setLanguageState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Locale) => {
    setLanguageState(lang);
    window.localStorage.setItem(STORAGE_KEY, lang);

    // Best-effort: keeps the preference on the account so server-side jobs
    // with no live request to read from (weekly report, welcome offer, risk
    // alerts — see app/api/cron/risk-alerts and app/api/send-email) know
    // which language to write in. Never blocks the UI toggle on this.
    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id;
      if (!userId) return;
      supabase.from('users').update({ language: lang }).eq('id', userId).then(() => {});
    });
  }, []);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      dict: dictionaries[language],
      localeTag: language === 'fr' ? 'fr-FR' : 'en-US',
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}

export function useTranslations<K extends keyof Dictionary>(section: K): Dictionary[K] {
  const { dict } = useLanguage();
  return dict[section];
}

export function useTierName() {
  const { dict } = useLanguage();
  return (frenchTierName: string) => dict.common.tierNames[frenchTierName] ?? frenchTierName;
}
