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

  const linkClass = 'hover:text-slate-900 dark:hover:text-white';
  const mobileLinkClass = 'block w-full rounded-xl px-4 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800';

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href={user ? '/dashboard' : '/'} className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
          Churn<span className="text-brand-600">ly</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageToggle />
          </div>

          {isAuthPage ? null : user ? (
            <>
              <Link href="/dashboard" className={linkClass}>{t.dashboard}</Link>
              <Link href="/upload" className={linkClass}>{t.upload}</Link>
              <Link href="/settings" className={linkClass}>{t.settings}</Link>
              {user.email && (
                <span className="hidden text-slate-400 dark:text-slate-500 lg:inline">{user.email}</span>
              )}
              <button
                onClick={handleLogout}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
              >
                {t.logout}
              </button>
            </>
          ) : (
            <>
              {pathname !== '/pricing' && <Link href="/pricing" className={linkClass}>{t.pricing}</Link>}
              <Link href="/login" className={linkClass}>{t.login}</Link>
              <Link
                href="/signup"
                className="rounded-full bg-brand-700 px-4 py-2 text-white transition hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                {t.startFree}
              </Link>
            </>
          )}
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 md:hidden">
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
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {menuOpen && !isAuthPage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950 md:hidden"
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
                  {pathname !== '/pricing' && <Link href="/pricing" className={mobileLinkClass}>{t.pricing}</Link>}
                  <Link href="/login" className={mobileLinkClass}>{t.login}</Link>
                  <Link
                    href="/signup"
                    className="mt-1 block w-full rounded-xl bg-brand-700 px-4 py-3 text-center text-base font-semibold text-white transition hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500"
                  >
                    {t.startFree}
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
