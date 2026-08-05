import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Churnly — Sauvez votre revenue',
  description:
    'Prédisez qui va partir avant qu\'il ne parte. Analyse de churn par IA pour SaaS, agences et startups.',
  openGraph: {
    images: [{ url: 'https://bolt.new/static/og_default.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [{ url: 'https://bolt.new/static/og_default.png' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
