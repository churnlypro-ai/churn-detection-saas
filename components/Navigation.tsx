'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useTranslations } from '@/lib/i18n/LanguageContext';

export default function Navigation({ user }: { user: { id?: string; email?: string } | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = useTranslations('nav');
  const tToc = useTranslations('home').toc;

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Sans ça, le contenu de la page défile visiblement sous le menu mobile
  // ouvert — un doigt qui scrolle par réflexe referme visuellement le menu
  // sans le fermer, effet désorientant sur petit écran.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.push('/login');
  }

  const isAuthPage = pathname === '/signup' || pathname === '/login';

  const linkClass = 'rounded-xl px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white';
  const mobileLinkClass = 'block w-full rounded-xl px-4 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800';

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 rounded-[20px] border border-slate-200 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/75 sm:gap-4 sm:px-4">
        <Link href={user ? '/dashboard' : '/'} className="shrink-0 px-2 py-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
          Churn<span className="text-brand-600">ly</span>
        </Link>

        {/* Desktop nav */}
        {!isAuthPage && (
          <div className="hidden flex-1 items-center justify-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
            {user ? (
              <>
                <Link href="/dashboard" className={linkClass}>{t.dashboard}</Link>
                <Link href="/upload" className={linkClass}>{t.upload}</Link>
                <Link href="/settings" className={linkClass}>{t.settings}</Link>
              </>
            ) : (
              <>
                <Link href="/#fonctionnalites" className={linkClass}>{tToc.features}</Link>
                <Link href="/#comment-ca-marche" className={linkClass}>{tToc.howItWorks}</Link>
                {pathname !== '/pricing' && <Link href="/pricing" className={linkClass}>{t.pricing}</Link>}
                <Link href="/#faq" className={linkClass}>{tToc.faq}</Link>
              </>
            )}
          </div>
        )}

        <div className={`hidden items-center gap-2 md:flex ${isAuthPage ? 'ml-auto' : ''}`}>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageToggle />
          </div>

          {!isAuthPage && (
            user ? (
              <>
                {user.email && (
                  <span className="hidden px-2 text-sm text-slate-400 dark:text-slate-500 lg:inline">{user.email}</span>
                )}
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-slate-200 px-4 py-1.5 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                  {t.logout}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800">
                  {t.login}
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-gradient-to-b from-brand-500 to-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
                >
                  {t.startFree}
                </Link>
              </>
            )
          )}
        </div>

        {/* Mobile controls */}
        <div className="ml-auto flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <LanguageToggle />
          {!isAuthPage && (
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? t.closeMenu : t.openMenu}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {menuOpen && !isAuthPage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-2 max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950 md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {user ? (
                <>
                  <Link href="/dashboard" className={mobileLinkClass}>{t.dashboard}</Link>
                  <Link href="/upload" className={mobileLinkClass}>{t.upload}</Link>
                  <Link href="/settings" className={mobileLinkClass}>{t.settings}</Link>
                  {user.email && (
                    <p className="px-4 py-1 text-sm text-slate-400 dark:text-slate-500">{user.email}</p>
                  )}
                  <button onClick={handleLogout} className={`${mobileLinkClass} text-left`}>
                    {t.logout}
                  </button>
                </>
              ) : (
                <>
                  <Link href="/#fonctionnalites" className={mobileLinkClass}>{tToc.features}</Link>
                  <Link href="/#comment-ca-marche" className={mobileLinkClass}>{tToc.howItWorks}</Link>
                  {pathname !== '/pricing' && <Link href="/pricing" className={mobileLinkClass}>{t.pricing}</Link>}
                  <Link href="/#faq" className={mobileLinkClass}>{tToc.faq}</Link>
                  <Link href="/login" className={mobileLinkClass}>{t.login}</Link>
                  <Link
                    href="/signup"
                    className="mt-1 block w-full rounded-xl bg-brand-600 px-4 py-3 text-center text-base font-semibold text-white transition hover:bg-brand-700"
                  >
                    {t.startFree}
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
