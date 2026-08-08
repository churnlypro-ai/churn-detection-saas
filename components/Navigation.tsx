'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Navigation({ user }: { user: { id?: string; email?: string } | null }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const isAuthPage = pathname === '/signup' || pathname === '/login';

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
          Churn<span className="text-brand-600">ly</span>
        </Link>

        <div className="flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <ThemeToggle />

          {isAuthPage ? null : user ? (
            <>
              <Link href="/dashboard" className="hover:text-slate-900 dark:hover:text-white">
                Dashboard
              </Link>
              <Link href="/settings" className="hover:text-slate-900 dark:hover:text-white">
                Réglages
              </Link>
              {user.email && (
                <span className="hidden text-slate-400 dark:text-slate-500 sm:inline">{user.email}</span>
              )}
              <button
                onClick={handleLogout}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              {pathname !== '/pricing' && (
                <Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white">
                  Tarifs
                </Link>
              )}
              <Link href="/login" className="hover:text-slate-900 dark:hover:text-white">
                Se connecter
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-brand-700 px-4 py-2 text-white transition hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                Commencer gratuitement
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
