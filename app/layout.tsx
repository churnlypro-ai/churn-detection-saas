import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import ThemeProviderClient from '@/components/ThemeProviderClient';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://churn-detection-saas.vercel.app'),
  title: 'Churnly — Sauvez votre revenue',
  description:
    'Prédisez qui va partir avant qu\'il ne parte. Analyse de churn par IA pour SaaS, agences et startups.',
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="bg-white font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-50">
        <ThemeProviderClient>{children}</ThemeProviderClient>
      </body>
    </html>
  );
}
