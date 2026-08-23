import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import ThemeProviderClient from '@/components/ThemeProviderClient';
import AdSourceCapture from '@/components/AdSourceCapture';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://churnly.fr'),
  title: 'Churnly — Sauvez votre revenu',
  description:
    'Prédisez qui va partir avant qu\'il ne parte. L\'expertise Churnly en analyse de churn pour SaaS, agences et startups.',
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
        <AdSourceCapture />
        <ThemeProviderClient>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProviderClient>
      </body>
    </html>
  );
}
