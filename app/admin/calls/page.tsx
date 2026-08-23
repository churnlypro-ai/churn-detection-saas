'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, XCircle, Clock, CheckCircle2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';

interface Booking {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  availability: string;
  status: 'pending' | 'confirmed' | 'canceled';
  confirmed_slot: string | null;
  confirmed_at: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<Booking['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  confirmed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  canceled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_LABELS: Record<Booking['status'], string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  canceled: 'Annulé',
};

export default function AdminCallsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [slotDrafts, setSlotDrafts] = useState<Record<string, string>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<Record<string, string>>({});

  const getAuthToken = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? '';
  }, []);

  const loadBookings = useCallback(async (authToken: string) => {
    const res = await fetch('/api/admin/call-bookings', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.ok) {
      const data = await res.json();
      setBookings(data.bookings ?? []);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) { router.replace('/login'); return; }
      setUser(data.user);

      const authToken = await getAuthToken();
      const check = await fetch('/api/admin/check', { headers: { Authorization: `Bearer ${authToken}` } })
        .then((r) => r.json()).catch(() => ({ isAdmin: false }));
      if (!check.isAdmin) { setForbidden(true); setLoading(false); return; }

      await loadBookings(authToken);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleConfirm(id: string) {
    const slot = (slotDrafts[id] ?? '').trim();
    if (!slot) {
      setConfirmError((prev) => ({ ...prev, [id]: 'Indique un créneau avant de confirmer.' }));
      return;
    }
    setConfirmingId(id);
    setConfirmError((prev) => ({ ...prev, [id]: '' }));
    try {
      const authToken = await getAuthToken();
      const res = await fetch(`/api/admin/call-bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ confirmedSlot: slot }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Confirmation échouée.');
      await loadBookings(authToken);
    } catch (err) {
      setConfirmError((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : 'Confirmation échouée.' }));
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleDelete(id: string) {
    const authToken = await getAuthToken();
    await fetch(`/api/admin/call-bookings/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
    await loadBookings(authToken);
  }

  if (forbidden) {
    return (
      <>
        <Navigation user={user} />
        <main className="mx-auto max-w-2xl px-6 py-24 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Accès refusé</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Cette page est réservée au compte ambassadeur.</p>
        </main>
      </>
    );
  }

  const pending = bookings.filter((b) => b.status === 'pending');
  const others = bookings.filter((b) => b.status !== 'pending');

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/admin" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> Retour à la vue d&apos;ensemble
        </Link>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="mb-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          Réservations de call
        </motion.h1>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          Demandes envoyées depuis le bouton &quot;Réserver un call&quot; de l&apos;accueil. Indique un créneau puis confirme pour que le visiteur reçoive l&apos;email avec la date exacte.
        </p>

        {loading ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : bookings.length === 0 ? (
          <p className="rounded-2xl border border-slate-100 bg-white px-6 py-8 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
            Aucune demande pour l&apos;instant.
          </p>
        ) : (
          <div className="space-y-6">
            {pending.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">En attente ({pending.length})</h2>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {pending.map((b) => (
                    <div key={b.id} className="px-6 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {b.name} {b.company_name && <span className="text-slate-400">· {b.company_name}</span>}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{b.email}</p>
                        </div>
                        <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[b.status]}`}>
                          <Clock className="h-3 w-3" /> {STATUS_LABELS[b.status]}
                        </span>
                      </div>
                      <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                        {b.availability}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          placeholder="Créneau confirmé (ex: Mardi 26 août à 14h00)"
                          value={slotDrafts[b.id] ?? ''}
                          onChange={(e) => setSlotDrafts((prev) => ({ ...prev, [b.id]: e.target.value }))}
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                        <button
                          onClick={() => handleConfirm(b.id)}
                          disabled={confirmingId === b.id}
                          className="flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {confirmingId === b.id ? 'Confirmation…' : 'Confirmer et envoyer'}
                        </button>
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="text-slate-300 transition hover:text-red-500 dark:text-slate-600"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {confirmError[b.id] && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{confirmError[b.id]}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {others.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Historique</h2>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {others.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-4 px-6 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{b.name}</p>
                        <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                          {b.email}{b.confirmed_slot ? ` · ${b.confirmed_slot}` : ''}
                        </p>
                      </div>
                      <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[b.status]}`}>
                        {b.status === 'confirmed' && <CheckCircle2 className="h-3 w-3" />}
                        {STATUS_LABELS[b.status]}
                      </span>
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="flex-shrink-0 text-slate-300 transition hover:text-red-500 dark:text-slate-600"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
