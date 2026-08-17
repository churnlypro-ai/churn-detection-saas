import { fr } from './dictionaries/fr';
import { en } from './dictionaries/en';

export type Locale = 'fr' | 'en';

export const dictionaries = { fr, en };

export const LOCALES: Locale[] = ['fr', 'en'];

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'fr' || value === 'en';
}
