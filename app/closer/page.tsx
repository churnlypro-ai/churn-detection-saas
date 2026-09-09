'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { XCircle, Clock, CheckCircle2, CalendarDays, CalendarClock, Trash2, Phone, PhoneOff, PhoneMissed, PhoneCall } from 'lucide-react';
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

type ProspectStatus = 'to_call' | 'interested' | 'not_interested' | 'no_answer' | 'callback';

interface Prospect {
  id: string;
  name: string;
  company_name: string;
  phone: string;
  sector: string | null;
  status: ProspectStatus;
  notes: string | null;
  called_by: string | null;
  called_at: string | null;
  created_at: string;
}

const PROSPECT_STATUS_LABEL: Record<ProspectStatus, string> = {
  to_call: 'À appeler',
  interested: 'Intéressé',
  not_interested: 'Pas intéressé',
  no_answer: 'Ne répond pas',
  callback: 'À rappeler',
};

export default function CloserPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [updatingProspectId, setUpdatingProspectId] = useState<string | null>(null);

  const [slotDrafts, setSlotDrafts] = useState<Record<string, string>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<Record<string, string>>({});

  const getAuthToken = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? '';
  }, []);

  const loadBookings = useCallback(async (authToken: string) => {
    const res = await fetch('/api/closer/bookings', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.ok) {
      const result = await res.json();
      setBookings(result.bookings ?? []);
    }
  }, []);

  const loadProspects = useCallback(async (authToken: string) => {
    const res = await fetch('/api/closer/prospects', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.ok) {
      const result = await res.json();
      setProspects(result.prospects ?? []);
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

      await Promise.all([loadBookings(authToken), loadProspects(authToken)]);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleUpdateProspectStatus(id: string, status: ProspectStatus) {
    setUpdatingProspectId(id);
    try {
      const authToken = await getAuthToken();
      const res = await fetch(`/api/closer/prospects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) await loadProspects(authToken);
    } finally {
      setUpdatingProspectId(null);
    }
  }

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
      const res = await fetch(`/api/closer/bookings/${id}`, {
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

  async function handleReject(id: string) {
    const authToken = await getAuthToken();
    await fetch(`/api/closer/bookings/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
    await loadBookings(authToken);
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

  const now = Date.now();
  const pending = bookings.filter((b) => b.status === 'pending');
  const confirmed = bookings.filter((b) => b.status === 'confirmed');
  const upcoming = confirmed.filter((b) => !b.slot_start || new Date(b.slot_start).getTime() >= now);
  const past = confirmed.filter((b) => b.slot_start && new Date(b.slot_start).getTime() < now);

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

        {!loading && prospects.length > 0 && (() => {
          const toCall = prospects.filter((p) => p.status === 'to_call');
          const handled = prospects.filter((p) => p.status !== 'to_call');
          return (
            <div className="mb-8 rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-brand-500" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Prospects à appeler ({toCall.length} restants sur {prospects.length})
                  </h2>
                </div>
              </div>
              {toCall.length === 0 ? (
                <p className="px-6 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                  Tous les prospects ont été traités.
                </p>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {toCall.map((p) => (
                    <div key={p.id} className="px-6 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {p.name} <span className="text-slate-400">· {p.company_name}</span>
                          </p>
                          {p.sector && <p className="text-xs text-slate-400 dark:text-slate-500">{p.sector}</p>}
                        </div>
                        <a
                          href={`tel:${p.phone.replace(/\s+/g, '')}`}
                          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                        >
                          <Phone className="h-3.5 w-3.5" /> {p.phone}
                        </a>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleUpdateProspectStatus(p.id, 'interested')}
                          disabled={updatingProspectId === p.id}
                          className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:bg-emerald-500/10 dark:text-emerald-400"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Intéressé
                        </button>
                        <button
                          onClick={() => handleUpdateProspectStatus(p.id, 'callback')}
                          disabled={updatingProspectId === p.id}
                          className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60 dark:bg-amber-500/10 dark:text-amber-400"
                        >
                          <Clock className="h-3.5 w-3.5" /> À rappeler
                        </button>
                        <button
                          onClick={() => handleUpdateProspectStatus(p.id, 'no_answer')}
                          disabled={updatingProspectId === p.id}
                          className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <PhoneMissed className="h-3.5 w-3.5" /> Ne répond pas
                        </button>
                        <button
                          onClick={() => handleUpdateProspectStatus(p.id, 'not_interested')}
                          disabled={updatingProspectId === p.id}
                          className="flex items-center gap-1.5 rounded-full bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60 dark:bg-red-500/10 dark:text-red-400"
                        >
                          <PhoneOff className="h-3.5 w-3.5" /> Pas intéressé
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {handled.length > 0 && (
                <details className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-400 dark:text-slate-500">
                    Déjà traités ({handled.length})
                  </summary>
                  <div className="mt-3 space-y-2">
                    {handled.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                          {p.name} · {p.company_name}
                        </span>
                        <span className="flex-shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500">
                          {PROSPECT_STATUS_LABEL[p.status]}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })()}

        {loading ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : bookings.length === 0 ? (
          <p className="rounded-2xl border border-slate-100 bg-white px-6 py-8 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
            Aucun appel réservé pour l&apos;instant.
          </p>
        ) : (
          <div className="space-y-6">
            {pending.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">À valider ({pending.length})</h2>
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
                        <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                          <Clock className="h-3 w-3" /> En attente de validation
                        </span>
                      </div>
                      <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
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
                          {confirmingId === b.id ? 'Confirmation…' : 'Valider et envoyer'}
                        </button>
                        <button
                          onClick={() => handleReject(b.id)}
                          className="text-slate-300 transition hover:text-red-500 dark:text-slate-600"
                          aria-label="Refuser"
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
                        <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          {b.slot_start ? formatParisDateTime(new Date(b.slot_start)) : b.confirmed_slot}
                        </span>
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
