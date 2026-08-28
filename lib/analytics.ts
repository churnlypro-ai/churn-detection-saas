// Petite couche au-dessus de gtag pour ne jamais planter le reste du site si
// GA4 n'est pas configuré (NEXT_PUBLIC_GA_MEASUREMENT_ID absent) ou si le
// script n'a pas encore fini de charger — voir components/GoogleAnalytics.tsx
// pour l'injection du tag.
export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== 'function') return;
  gtag('event', eventName, params);
}
