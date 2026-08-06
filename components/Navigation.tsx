'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Navigation({ user }: { user: { id?: string; email?: string } | null }) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
          Churn<span className="text-brand-600">ly</span>
        </Link>

        <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
          {user ? (
            <>
              <Link href="/dashboard" className="hover:text-slate-900">
                Dashboard
              </Link>
              <Link href="/settings" className="hover:text-slate-900">
                Réglages
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-slate-900">
                Se connecter
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-brand-700 px-4 py-2 text-white transition hover:bg-brand-800"
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
