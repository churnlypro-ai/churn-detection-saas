'use client';

import Script from 'next/script';
import { useCookieConsent } from '@/lib/cookieConsent';

// N'injecte rien tant que NEXT_PUBLIC_GA_MEASUREMENT_ID n'est pas configuré
// (même logique que SENTRY_DSN — un env var optionnel absent désactive la
// fonctionnalité proprement plutôt que de casser le build ou d'envoyer un
// ID vide à Google), NI tant que le visiteur n'a pas explicitement accepté
// les cookies de mesure d'audience (voir CookieConsentBanner) — avant ce
// fix, GA4 se chargeait sans consentement dès que la variable d'env était
// configurée sur Vercel, ce qui posait un vrai problème RGPD/ePrivacy pour
// les visiteurs français/européens (dépôt de cookie de traçage sans accord
// préalable).
export default function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const { consent } = useCookieConsent();
  if (!measurementId || consent !== 'accepted') return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
