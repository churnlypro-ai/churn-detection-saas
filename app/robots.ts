import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://churnly.fr';

// Explicitement permissif pour les agents IA (résumeurs, assistants de
// recherche...) — le site doit être aussi accessible pour eux que pour un
// visiteur humain, voir aussi /llms.txt (résumé dédié) et le fix du rendu
// des statistiques animées dans app/page.tsx (visibles dans le HTML brut
// sans exécuter de JS). Seules les zones privées/authentifiées sont
// exclues, pas parce qu'on veut les cacher d'une IA en particulier, mais
// parce que ce sont des pages de connexion vides pour quiconque n'est pas
// authentifié — rien d'utile à indexer derrière.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/dashboard/', '/settings/', '/closer/', '/upload/', '/preview/', '/impact/', '/audit/'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
