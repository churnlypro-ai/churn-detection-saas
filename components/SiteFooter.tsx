'use client';

import Link from 'next/link';
import FadeLine from '@/components/FadeLine';
import { useTranslations } from '@/lib/i18n/LanguageContext';

// Pied de page commun aux pages publiques (home, /pricing, /avis, /demo...)
// — bloc de marque + colonnes Produit/Légal, extrait de app/page.tsx pour
// que toutes les pages publiques partagent le même pied de page plutôt que
// de dupliquer (et de laisser diverger) chacune sa propre version.
export default function SiteFooter() {
  const tFooter = useTranslations('home').footer;
  const tToc = useTranslations('home').toc;

  return (
    <footer className="relative bg-white py-14 dark:bg-slate-950">
      <FadeLine className="top-0" />
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6">
        <div className="flex flex-wrap justify-between gap-10">
          <div className="flex max-w-sm flex-col gap-3">
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Churnly</span>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-500">{tFooter.tagline}</p>
          </div>
          <div className="flex flex-wrap gap-12">
            <nav aria-label={tFooter.productLabel} className="flex flex-col gap-1">
              <span className="pb-2 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tFooter.productLabel}</span>
              <Link href="/#fonctionnalites" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tToc.features}</Link>
              <Link href="/#comment-ca-marche" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tToc.howItWorks}</Link>
              <Link href="/pricing" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tToc.pricing}</Link>
              <Link href="/#faq" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tToc.faq}</Link>
            </nav>
            <nav aria-label={tFooter.legalLabel} className="flex flex-col gap-1">
              <span className="pb-2 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tFooter.legalLabel}</span>
              <Link href="/confidentialite" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tFooter.privacy}</Link>
              <Link href="/conditions" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tFooter.terms}</Link>
              <Link href="/politique-cookies" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tFooter.cookies}</Link>
              <Link href="/remboursement" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tFooter.refund}</Link>
              <Link href="/mentions-legales" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tFooter.legalNotice}</Link>
              <a href="mailto:contact@churnly.fr" className="flex min-h-[32px] items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">{tFooter.contact}</a>
            </nav>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-6 text-sm text-slate-400 dark:border-slate-900 dark:text-slate-500">
          <span>© {new Date().getFullYear()} Churnly</span>
          <span>{tFooter.poweredBy}</span>
        </div>
      </div>
    </footer>
  );
}
