'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, XCircle, Star, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';

interface Testimonial {
  id: string;
  user_id: string | null;
  author_name: string;
  company_name: string | null;
  role_title: string | null;
  rating: number;
  content: string;
  created_at: string;
}

interface AddDraft {
  authorName: string;
  companyName: string;
  roleTitle: string;
  rating: number;
  content: string;
}

const EMPTY_DRAFT: AddDraft = { authorName: '', companyName: '', roleTitle: '', rating: 5, content: '' };

export default function AdminTestimonialsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState<AddDraft>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError('');
    try {
      const authToken = await getAuthToken();
      const res = await fetch('/api/admin/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          authorName: draft.authorName,
          companyName: draft.companyName || null,
          roleTitle: draft.roleTitle || null,
          rating: draft.rating,
          content: draft.content,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Ajout échoué.');
      setDraft(EMPTY_DRAFT);
      setShowAddForm(false);
      await load(authToken);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Ajout échoué.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Supprimer cet avis ? Il disparaît aussi de la page d\'accueil.')) return;
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

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Admin
        </Link>

        <h1 className="mt-4 mb-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Avis clients</h1>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          Publié immédiatement dès qu&apos;un client le soumet sur <Link href="/avis" className="text-brand-600 hover:underline dark:text-brand-400">/avis</Link>, ou ajoute-en un ici toi-même. Visible sur la page d&apos;accueil tant qu&apos;il n&apos;est pas supprimé.
        </p>

        {!loading && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setShowAddForm((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400"
              >
                <Plus className="h-4 w-4" /> Ajouter un avis manuellement
              </button>

              {showAddForm && (
                <form onSubmit={handleAdd} className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      placeholder="Nom"
                      value={draft.authorName}
                      onChange={(e) => setDraft((d) => ({ ...d, authorName: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Entreprise"
                      value={draft.companyName}
                      onChange={(e) => setDraft((d) => ({ ...d, companyName: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                    <input
                      type="text"
                      placeholder="Poste (optionnel)"
                      value={draft.roleTitle}
                      onChange={(e) => setDraft((d) => ({ ...d, roleTitle: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, rating: n }))}
                          className="p-0.5"
                        >
                          <Star className={`h-5 w-5 ${n <= draft.rating ? 'fill-brand-500 text-brand-500' : 'text-slate-300 dark:text-slate-700'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    required
                    rows={3}
                    placeholder="Contenu de l'avis"
                    value={draft.content}
                    onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  {addError && <p className="text-sm text-red-600 dark:text-red-400">{addError}</p>}
                  <button
                    type="submit"
                    disabled={adding}
                    className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 dark:hover:bg-brand-500"
                  >
                    {adding ? 'Ajout…' : 'Publier'}
                  </button>
                </form>
              )}
            </div>

            {testimonials.length === 0 ? (
              <p className="rounded-2xl border border-slate-100 bg-white px-6 py-10 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
                Aucun avis pour l&apos;instant.
              </p>
            ) : (
              <div className="space-y-4">
                {testimonials.map((tItem) => (
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
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {new Date(tItem.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {!tItem.user_id && ' · ajouté manuellement'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(tItem.id)}
                        disabled={actingId === tItem.id}
                        className="flex-shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-500/10"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">&ldquo;{tItem.content}&rdquo;</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
