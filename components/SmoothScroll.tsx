'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';

// Écrans applicatifs (formulaires, tableaux, panneaux qui scrollent en
// interne) : le confort "page marketing" d'un scroll inertiel ne sert à
// rien et peut même gêner un scroll précis dans un petit panneau. On ne
// l'active donc que sur le site public (accueil, tarifs, avis...).
const APP_PREFIXES = ['/dashboard', '/settings', '/upload', '/admin', '/closer', '/audit', '/demo', '/post-login', '/preview'];

export default function SmoothScroll() {
  const pathname = usePathname();
  const isAppScreen = APP_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  useEffect(() => {
    if (isAppScreen) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.35,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      autoRaf: true,
      anchors: true,
    });

    return () => {
      lenis.destroy();
    };
  }, [isAppScreen]);

  return null;
}
