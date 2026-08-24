'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { XCircle, Clock, CheckCircle2, CalendarDays, CalendarClock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';
import { formatParisDateTime } from '@/lib/timezone';

interface Booking {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  availability: string;
  status: 'pending' | 'confirmed' | 'canceled';
  confirmed_slot: string | null;
  slot_start: string | null;
  created_at: string;
}

export default function CloserPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const getAuthToken = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? '';
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) { router.replace('/login'); return; }
      setUser(data.user);

      const authToken = await getAuthToken();
      const check = await fetch('/api/closer/check', { headers: { Authorization: `Bearer ${authToken}` } })
        .then((r) => r.json()).catch(() => ({ isCloser: false }));
      if (!check.isCloser) { setForbidden(true); setLoading(false); return; }

      const res = await fetch('/api/closer/bookings', { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) {
        const result = await res.json();
        setBookings(result.bookings ?? []);
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (forbidden) {
    return (
      <>
        <Navigation user={user} />
        <main className="mx-auto max-w-2xl px-6 py-24 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Accès refusé</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Cet espace est réservé au closer.</p>
        </main>
      </>
    );
  }

  const now = Date.now();
  const upcoming = bookings.filter((b) => !b.slot_start || new Date(b.slot_start).getTime() >= now);
  const past = bookings.filter((b) => b.slot_start && new Date(b.slot_start).getTime() < now);

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
          >
            Mes appels
          </motion.h1>
          <Link
            href="/closer/availability"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <CalendarClock className="h-4 w-4" /> Mes disponibilités
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : bookings.length === 0 ? (
          <p className="rounded-2xl border border-slate-100 bg-white px-6 py-8 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
            Aucun appel réservé pour l&apos;instant.
          </p>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">À venir ({upcoming.length})</h2>
              </div>
              {upcoming.length === 0 ? (
                <p className="px-6 py-6 text-center text-sm text-slate-400 dark:text-slate-500">Rien de prévu.</p>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {upcoming.map((b) => (
                    <div key={b.id} className="px-6 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {b.name} {b.company_name && <span className="text-slate-400">· {b.company_name}</span>}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{b.email}</p>
                        </div>
                        {b.slot_start ? (
                          <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> {formatParisDateTime(new Date(b.slot_start))}
                          </span>
                        ) : (
                          <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                            <Clock className="h-3 w-3" /> Créneau à confirmer
                          </span>
                        )}
                      </div>
                      <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                        {b.availability}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {past.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Passés ({past.length})</h2>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {past.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-4 px-6 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{b.name}</p>
                        <p className="truncate text-xs text-slate-400 dark:text-slate-500">{b.email}</p>
                      </div>
                      <span className="flex-shrink-0 text-xs text-slate-400 dark:text-slate-500">
                        {b.slot_start && formatParisDateTime(new Date(b.slot_start))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
