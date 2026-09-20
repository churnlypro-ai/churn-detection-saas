'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ConsentStatus = 'accepted' | 'rejected' | null;

const STORAGE_KEY = 'churnly_cookie_consent';

interface CookieConsentContextValue {
  // null tant que le visiteur n'a pas encore choisi — c'est ce qui déclenche
  // l'affichage du bandeau (voir CookieConsentBanner). Une fois choisi, la
  // préférence est mémorisée et le bandeau ne réapparaît plus tant qu'elle
  // n'est pas explicitement réinitialisée (voir resetConsent, utilisé par
  // /politique-cookies pour "gérer mes préférences").
  consent: ConsentStatus;
  accept: () => void;
  reject: () => void;
  resetConsent: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  // Toujours null au premier rendu serveur (comme LanguageProvider) — la
  // vraie valeur ne peut venir que de localStorage, lu uniquement côté
  // client dans l'effet ci-dessous, pour ne jamais désynchroniser le HTML
  // serveur et client à l'hydratation.
  const [consent, setConsent] = useState<ConsentStatus>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'accepted' || stored === 'rejected') setConsent(stored);
    } catch {
      // localStorage indisponible (navigation privée stricte, quota...) —
      // le bandeau reste affiché à chaque visite, dégradation acceptable.
    }
  }, []);

  const persist = useCallback((value: 'accepted' | 'rejected') => {
    setConsent(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // best-effort
    }
  }, []);

  const accept = useCallback(() => persist('accepted'), [persist]);
  const reject = useCallback(() => persist('rejected'), [persist]);
  const resetConsent = useCallback(() => {
    setConsent(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // best-effort
    }
  }, []);

  return (
    <CookieConsentContext.Provider value={{ consent, accept, reject, resetConsent }}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error('useCookieConsent must be used within a CookieConsentProvider');
  return ctx;
}
