'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, XCircle, Star, Check, X, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';

type Status = 'pending' | 'approved' | 'rejected';

interface Testimonial {
  id: string;
  user_id: string;
  author_name: string;
  company_name: string | null;
  role_title: string | null;
  rating: number;
  content: string;
  status: Status;
  created_at: string;
  reviewed_at: string | null;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Rejeté',
};

const STATUS_BADGE: Record<Status, string> = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  rejected: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
};

export default function AdminTestimonialsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('pending');
  const [actingId, setActingId] = useState<string | null>(null);

  const getAuthToken = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? '';
  }, []);

  const load = useCallback(async (authToken: string) => {
    const res = await fetch('/api/admin/testimonials', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.ok) {
      const result = await res.json();
      setTestimonials(result.testimonials ?? []);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) { router.replace('/login'); return; }
      setUser(data.user);
      const authToken = await getAuthToken();
      const checkRes = await fetch('/api/admin/check', { headers: { Authorization: `Bearer ${authToken}` } });
      const checkResult = await checkRes.json().catch(() => ({}));
      if (checkRes.status === 403 || !checkRes.ok || !checkResult.isAdmin) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      await load(authToken);
      setLoading(false);
    });
  }, [router, getAuthToken, load]);

  async function setStatus(id: string, status: Status) {
    setActingId(id);
    try {
      const authToken = await getAuthToken();
      await fetch(`/api/admin/testimonials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ status }),
      });
      await load(authToken);
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Supprimer cet avis définitivement ?')) return;
    setActingId(id);
    try {
      const authToken = await getAuthToken();
      await fetch(`/api/admin/testimonials/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
      await load(authToken);
    } finally {
      setActingId(null);
    }
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

  const counts = {
    pending: testimonials.filter((t) => t.status === 'pending').length,
    approved: testimonials.filter((t) => t.status === 'approved').length,
    rejected: testimonials.filter((t) => t.status === 'rejected').length,
  };
  const filtered = statusFilter === 'all' ? testimonials : testimonials.filter((t) => t.status === statusFilter);

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Admin
        </Link>

        <h1 className="mt-4 mb-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Avis clients</h1>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          Approuve un avis pour qu&apos;il apparaisse sur la page d&apos;accueil. Rien n&apos;est public tant que tu ne l&apos;as pas validé ici.
        </p>

        {!loading && (
          <>
            <div className="mb-6 flex flex-wrap gap-2">
              {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    statusFilter === s
                      ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {s === 'all' ? 'Tous' : STATUS_LABEL[s]}
                  {s !== 'all' && ` (${counts[s]})`}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <p className="rounded-2xl border border-slate-100 bg-white px-6 py-10 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
                Aucun avis ici.
              </p>
            ) : (
              <div className="space-y-4">
                {filtered.map((tItem) => (
                  <div key={tItem.id} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-1 flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < tItem.rating ? 'fill-brand-500 text-brand-500 dark:fill-brand-400 dark:text-brand-400' : 'text-slate-300 dark:text-slate-700'}`} />
                          ))}
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {tItem.author_name}{tItem.company_name ? ` · ${tItem.company_name}` : ''}{tItem.role_title ? `, ${tItem.role_title}` : ''}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(tItem.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <span className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[tItem.status]}`}>{STATUS_LABEL[tItem.status]}</span>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">&ldquo;{tItem.content}&rdquo;</p>

                    <div className="mt-4 flex items-center gap-2">
                      {tItem.status !== 'approved' && (
                        <button
                          onClick={() => setStatus(tItem.id, 'approved')}
                          disabled={actingId === tItem.id}
                          className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <Check className="h-3.5 w-3.5" /> Approuver
                        </button>
                      )}
                      {tItem.status !== 'rejected' && (
                        <button
                          onClick={() => setStatus(tItem.id, 'rejected')}
                          disabled={actingId === tItem.id}
                          className="flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <X className="h-3.5 w-3.5" /> Rejeter
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(tItem.id)}
                        disabled={actingId === tItem.id}
                        className="ml-auto flex items-center gap-1.5 rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-500/10"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
