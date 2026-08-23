'use client';

import { useEffect } from 'react';
import { captureAdSourceFromUrl } from '@/lib/adAttribution';

// Rendu une seule fois dans le layout racine — capte utm_source/utm_medium/
// utm_campaign sur n'importe quelle page d'entrée, pas seulement /signup :
// une pub renvoie en général vers la landing page, et le visiteur clique
// ensuite sur "Commencer gratuitement" en perdant les paramètres d'URL.
export default function AdSourceCapture() {
  useEffect(() => {
    captureAdSourceFromUrl(window.location.search);
  }, []);
  return null;
}
