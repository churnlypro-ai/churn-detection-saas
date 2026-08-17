/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Requis pour que instrumentation.ts (init Sentry côté serveur/edge) soit
  // chargé — stable par défaut à partir de Next 14, encore derrière ce flag
  // sur la version 13.5.1 utilisée ici.
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
