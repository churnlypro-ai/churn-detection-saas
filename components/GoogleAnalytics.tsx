import Script from 'next/script';

// N'injecte rien tant que NEXT_PUBLIC_GA_MEASUREMENT_ID n'est pas configuré
// (même logique que SENTRY_DSN — un env var optionnel absent désactive la
// fonctionnalité proprement plutôt que de casser le build ou d'envoyer un
// ID vide à Google).
export default function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!measurementId) return null;

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
