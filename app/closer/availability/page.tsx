'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, XCircle, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';

interface Slot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export default function CloserAvailabilityPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);

  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const getAuthToken = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? '';
  }, []);

  const loadSlots = useCallback(async (authToken: string) => {
    const res = await fetch('/api/closer/availability', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.ok) {
      const result = await res.json();
      setSlots(result.slots ?? []);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) { router.replace('/login'); return; }
      setUser(data.user);

      const authToken = await getAuthToken();
      const check = await fetch('/api/closer/check', { headers: { Authorization: `Bearer ${authToken}` } })
        .then((r) => r.json()).catch(() => ({ isCloser: false }));
      if (!check.isCloser) { setForbidden(true); setLoading(false); return; }

      await loadSlots(authToken);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError('');
    try {
      const authToken = await getAuthToken();
      const res = await fetch('/api/closer/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ dayOfWeek, startTime, endTime }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Ajout échoué.');
      await loadSlots(authToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ajout échoué.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    const authToken = await getAuthToken();
    await fetch(`/api/closer/availability/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
    await loadSlots(authToken);
  }

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

  const slotsByDay = DAYS.map((_, dow) => slots.filter((s) => s.day_of_week === dow)).map((arr) =>
    arr.sort((a, b) => a.start_time.localeCompare(b.start_time))
  );

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link href="/closer" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> Retour à mes appels
        </Link>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="mb-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          Mes disponibilités
        </motion.h1>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          Ces créneaux récurrents (heure de Paris) sont ce que les visiteurs voient sur le formulaire de réservation de l&apos;accueil — ils ne peuvent choisir que dedans.
        </p>

        {loading ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : (
          <>
            <form onSubmit={handleAdd} className="mb-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Ajouter un créneau récurrent</h2>
              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <span className="text-sm text-slate-400">à</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={adding}
                  className="flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" /> {adding ? 'Ajout…' : 'Ajouter'}
                </button>
              </div>
              {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
            </form>

            <div className="space-y-3">
              {DAYS.map((day, dow) => (
                <div key={dow} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{day}</h3>
                  {slotsByDay[dow].length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500">Aucun créneau</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {slotsByDay[dow].map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
                        >
                          {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                          <button onClick={() => handleDelete(s.id)} aria-label="Supprimer" className="text-brand-400 hover:text-red-500">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
