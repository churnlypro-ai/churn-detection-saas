'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  XCircle, Clock, CheckCircle2, CalendarDays, CalendarClock, Trash2,
  Phone, PhoneOff, PhoneMissed, PhoneCall, TrendingUp, Users, BookOpen, ListChecks, Lightbulb,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';
import { formatParisDateTime } from '@/lib/timezone';
import { getApproachHint } from '@/lib/closerApproach';

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

type Tab = 'prospects' | 'rdv' | 'argumentaire';

export default function CloserPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [updatingProspectId, setUpdatingProspectId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>('prospects');

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
      const notes = (noteDrafts[id] ?? '').trim();
      const res = await fetch(`/api/closer/prospects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ status, ...(notes ? { notes } : {}) }),
      });
      if (res.ok) {
        setNoteDrafts((prev) => ({ ...prev, [id]: '' }));
        await loadProspects(authToken);
      }
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

  const now = Date.now();
  const pending = bookings.filter((b) => b.status === 'pending');
  const confirmed = bookings.filter((b) => b.status === 'confirmed');
  const upcoming = confirmed.filter((b) => !b.slot_start || new Date(b.slot_start).getTime() >= now);
  const past = confirmed.filter((b) => b.slot_start && new Date(b.slot_start).getTime() < now);

  const toCall = prospects.filter((p) => p.status === 'to_call');
  const handledProspects = prospects.filter((p) => p.status !== 'to_call');
  const interestedCount = prospects.filter((p) => p.status === 'interested').length;

  const stats = useMemo(() => [
    { label: 'À appeler', value: toCall.length, icon: PhoneCall, color: 'text-brand-600 dark:text-brand-400' },
    { label: 'Appelés', value: handledProspects.length, icon: ListChecks, color: 'text-slate-600 dark:text-slate-300' },
    { label: 'Intéressés', value: interestedCount, icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'RDV à venir', value: upcoming.length, icon: CalendarDays, color: 'text-amber-600 dark:text-amber-400' },
  ], [toCall.length, handledProspects.length, interestedCount, upcoming.length]);

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

  const tabs: { id: Tab; label: string; icon: typeof PhoneCall; count?: number }[] = [
    { id: 'prospects', label: 'Prospects à appeler', icon: PhoneCall, count: toCall.length },
    { id: 'rdv', label: 'Mes rendez-vous', icon: CalendarDays, count: pending.length + upcoming.length },
    { id: 'argumentaire', label: 'Argumentaire & pricing', icon: BookOpen },
  ];

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
              className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
            >
              Espace Closer
            </motion.h1>
            {user?.email && <p className="text-sm text-slate-400 dark:text-slate-500">{user.email}</p>}
          </div>
          <Link
            href="/closer/availability"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <CalendarClock className="h-4 w-4" /> Mes disponibilités
          </Link>
        </div>

        {!loading && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-100 bg-white px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-1.5">
                  <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{s.label}</span>
                </div>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mb-6 flex gap-1 rounded-full border border-slate-100 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition ${
                tab === t.id
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {typeof t.count === 'number' && t.count > 0 && (
                <span className={`rounded-full px-1.5 text-[10px] ${tab === t.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading && <p className="text-sm text-slate-400">Chargement…</p>}

        {!loading && tab === 'prospects' && (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {prospects.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                Aucun prospect chargé pour l&apos;instant.
              </p>
            ) : toCall.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                Tous les prospects ont été traités.
              </p>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {toCall.map((p) => {
                  const hint = getApproachHint(p.sector);
                  return (
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

                    <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/50 p-3.5 dark:border-brand-500/20 dark:bg-brand-500/5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-400">
                        <Lightbulb className="h-3.5 w-3.5" /> Analyse & approche suggérée
                      </div>
                      <dl className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div><dt className="inline font-medium text-slate-500 dark:text-slate-400">Profil : </dt><dd className="inline">{hint.profil}</dd></div>
                        <div><dt className="inline font-medium text-slate-500 dark:text-slate-400">Méthode : </dt><dd className="inline">{hint.angle}</dd></div>
                        <div><dt className="inline font-medium text-slate-500 dark:text-slate-400">Accroche : </dt><dd className="inline italic">&laquo;&nbsp;{hint.accroche}&nbsp;&raquo;</dd></div>
                        <div><dt className="inline font-medium text-slate-500 dark:text-slate-400">Question à poser : </dt><dd className="inline italic">&laquo;&nbsp;{hint.question}&nbsp;&raquo;</dd></div>
                      </dl>
                    </div>

                    <input
                      type="text"
                      placeholder="Note (objection, contexte, à rappeler quand…)"
                      value={noteDrafts[p.id] ?? ''}
                      onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
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
                  );
                })}
              </div>
            )}
            {handledProspects.length > 0 && (
              <details className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                <summary className="cursor-pointer text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Déjà traités ({handledProspects.length})
                </summary>
                <div className="mt-3 space-y-3">
                  {handledProspects.map((p) => (
                    <div key={p.id} className="text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                          {p.name} · {p.company_name}
                        </span>
                        <span className="flex-shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500">
                          {PROSPECT_STATUS_LABEL[p.status]}
                        </span>
                      </div>
                      {p.notes && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{p.notes}</p>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {!loading && tab === 'rdv' && (
          bookings.length === 0 ? (
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
          )
        )}

        {!loading && tab === 'argumentaire' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <TrendingUp className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Ce qu&apos;est Churnly</h2>
              </div>
              <ul className="space-y-3 px-6 py-5 text-sm text-slate-600 dark:text-slate-300">
                <li>• Analyse IA (Claude / Anthropic) du fichier clients : score de risque de churn 0-100 par client, avec facteurs cités et niveau de confiance.</li>
                <li>• Fenêtre de prédiction : 30 à 60 jours avant le départ probable du client.</li>
                <li>• Premier scan gratuit, sans carte bancaire — le client voit son taux de churn réel avant de payer quoi que ce soit.</li>
                <li>• Aucune donnée personnelle des clients finaux n&apos;est stockée durablement ; suppression en un clic.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <Users className="h-4 w-4 text-emerald-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Pourquoi ça compte (chiffres à citer)</h2>
              </div>
              <ul className="space-y-3 px-6 py-5 text-sm text-slate-600 dark:text-slate-300">
                <li>• Retenir un client coûte 5 à 7 fois moins cher que d&apos;en acquérir un nouveau.</li>
                <li>• Un churn de 5%/mois qui semble anodin représente ~46% de clients perdus sur un an (effet composé).</li>
                <li>• Chaque mois sans action, l&apos;érosion continue silencieusement — l&apos;intérêt est d&apos;agir avant, pas après le départ.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <BookOpen className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Grille tarifaire</h2>
              </div>
              <div className="space-y-3 px-6 py-5 text-sm text-slate-600 dark:text-slate-300">
                <p><strong className="text-slate-900 dark:text-white">Standard :</strong> 60€/mois sous 2 000€ de CA mensuel ; au-delà, 100€ + 150€ tous les 10 000€ de CA supplémentaires, plafonné à 2 500€/mois.</p>
                <p><strong className="text-slate-900 dark:text-white">Performance :</strong> toujours exactement la moitié du prix Standard, plafonnée à 300€/mois — moins cher que Standard à tous les niveaux de revenu.</p>
                <p><strong className="text-slate-900 dark:text-white">Groupe témoin (Performance) :</strong> 3% des clients à risque ne reçoivent volontairement pas de relance, pour mesurer l&apos;effet réel de Churnly par comparaison — c&apos;est ce qui rend la facturation à la performance honnête et vérifiable, pas un argument de vente à minimiser.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Objections fréquentes</h2>
              </div>
              <ul className="space-y-3 px-6 py-5 text-sm text-slate-600 dark:text-slate-300">
                <li>• <strong className="text-slate-900 dark:text-white">« On n&apos;a pas de problème de churn »</strong> → Le premier scan est gratuit et sans engagement, justement pour vérifier ça avant de discuter prix.</li>
                <li>• <strong className="text-slate-900 dark:text-white">« C&apos;est cher »</strong> → Comparer au coût d&apos;acquisition d&apos;un client perdu (5-7x plus cher) et proposer le plan Performance, toujours moins cher que Standard.</li>
                <li>• <strong className="text-slate-900 dark:text-white">« Nos données clients sont sensibles »</strong> → Aucune donnée personnelle finale n&apos;est conservée, suppression en un clic à tout moment.</li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
