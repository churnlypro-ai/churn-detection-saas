'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { XCircle, Plus, Copy, Check, PauseCircle, PlayCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';

interface Affiliate {
  id: string;
  name: string;
  email: string;
  referral_code: string;
  commission_rate: number;
  payout_method: string | null;
  status: 'active' | 'paused';
  pending_cents: number;
  paid_cents: number;
}

function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export default function AdminAffiliatesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [commissionRate, setCommissionRate] = useState('20');
  const [payoutMethod, setPayoutMethod] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const getAuthToken = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? '';
  }, []);

  const loadAffiliates = useCallback(async (authToken: string) => {
    const res = await fetch('/api/admin/affiliates', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.status === 403) return 'forbidden';
    if (res.ok) {
      const result = await res.json();
      setAffiliates(result.affiliates ?? []);
    }
    return 'ok';
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) { router.replace('/login'); return; }
      setUser(data.user);
      const authToken = await getAuthToken();
      const status = await loadAffiliates(authToken);
      if (status === 'forbidden') setForbidden(true);
      setLoading(false);
    });
  }, [router, getAuthToken, loadAffiliates]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const rate = Number(commissionRate) / 100;
    if (!name.trim() || !email.trim()) {
      setFormError('Nom et email requis.');
      return;
    }
    setCreating(true);
    try {
      const authToken = await getAuthToken();
      const res = await fetch('/api/admin/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), commissionRate: rate, payoutMethod: payoutMethod.trim() || null }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Création échouée.');
      setName(''); setEmail(''); setCommissionRate('20'); setPayoutMethod(''); setShowForm(false);
      await loadAffiliates(authToken);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Création échouée.');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleStatus(id: string, current: 'active' | 'paused') {
    const authToken = await getAuthToken();
    await fetch(`/api/admin/affiliates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ status: current === 'active' ? 'paused' : 'active' }),
    });
    await loadAffiliates(authToken);
  }

  async function handleMarkPaid(id: string) {
    const authToken = await getAuthToken();
    await fetch(`/api/admin/affiliates/${id}/mark-paid`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    await loadAffiliates(authToken);
  }

  function handleCopyLink(code: string) {
    const link = `${window.location.origin}/?aff=${code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  }

  if (forbidden) {
    return (
      <>
        <Navigation user={user} />
        <main className="mx-auto max-w-2xl px-6 py-24 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Accès refusé</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Admin
        </Link>

        <div className="mt-4 mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Affiliation</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Ajouter un affilié
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mb-8 space-y-3 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text" placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <input
                type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <input
                type="number" min={1} max={100} placeholder="Commission %" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <input
                type="text" placeholder="IBAN ou email PayPal (optionnel)" value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}
            <button
              type="submit" disabled={creating}
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {creating ? 'Création…' : 'Créer'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : affiliates.length === 0 ? (
          <p className="rounded-2xl border border-slate-100 bg-white px-6 py-8 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
            Aucun affilié pour l&apos;instant.
          </p>
        ) : (
          <div className="space-y-3">
            {affiliates.map((a) => (
              <div key={a.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {a.name} <span className="text-slate-400">· {a.email}</span>
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {(a.commission_rate * 100).toFixed(0)}% récurrent {a.payout_method && `· ${a.payout_method}`}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${a.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {a.status === 'active' ? 'Actif' : 'En pause'}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleCopyLink(a.referral_code)}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {copiedCode === a.referral_code ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copier le lien
                  </button>
                  <button
                    onClick={() => handleToggleStatus(a.id, a.status)}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {a.status === 'active' ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
                    {a.status === 'active' ? 'Mettre en pause' : 'Réactiver'}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-50 pt-3 text-sm dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">
                    Dû : <strong className="text-slate-900 dark:text-white">{formatEuro(a.pending_cents)}</strong>
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">
                    Déjà payé : {formatEuro(a.paid_cents)}
                  </span>
                  {a.pending_cents > 0 && (
                    <button
                      onClick={() => handleMarkPaid(a.id)}
                      className="ml-auto rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Marquer comme payé
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
