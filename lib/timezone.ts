// Un seul closer, un seul fuseau pour l'instant — pas de gestion multi-fuseau.
export const CLOSER_TIMEZONE = 'Europe/Paris';

// Convertit une heure murale Europe/Paris (ex: 2026-08-25 + "14:30") en
// instant UTC réel, sans dépendance externe : on part d'un instant "naïf"
// (comme si l'heure donnée était déjà de l'UTC), on regarde comment cet
// instant s'affiche à Paris, et la différence donne le décalage exact de ce
// jour précis (gère automatiquement l'heure d'été/hiver).
export function parisWallTimeToUtc(dateStr: string, timeStr: string): Date {
  const naive = new Date(`${dateStr}T${timeStr}:00Z`);
  const parisString = naive.toLocaleString('en-US', { timeZone: CLOSER_TIMEZONE });
  const utcString = naive.toLocaleString('en-US', { timeZone: 'UTC' });
  const offsetMs = new Date(utcString).getTime() - new Date(parisString).getTime();
  return new Date(naive.getTime() + offsetMs);
}

// Date du jour à Paris au format YYYY-MM-DD (indépendant du fuseau du
// serveur, qui tourne en UTC sur Vercel).
export function todayParisDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: CLOSER_TIMEZONE });
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// Pur calcul calendaire (0 = dimanche ... 6 = samedi), sans ambiguïté de
// fuseau puisqu'on construit et relit le timestamp en UTC pour la même date.
export function dayOfWeekOfDateString(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function formatParisDateTime(date: Date, language: 'fr' | 'en' = 'fr'): string {
  return date.toLocaleString(language === 'en' ? 'en-US' : 'fr-FR', {
    timeZone: CLOSER_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
