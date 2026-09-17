'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';
import { Star, Check, Pencil, ArrowRight } from 'lucide-react';
import { useLanguage, useTranslations } from '@/lib/i18n/LanguageContext';

interface Testimonial {
  id: string;
  author_name: string;
  company_name: string | null;
  role_title: string | null;
  rating: number;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
}

const CONTENT_MAX = 600;

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1.5" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (hovered || value) >= n;
        return (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHovered(n)}
            onClick={() => onChange(n)}
            className="p-0.5 transition"
            aria-label={`${n} étoiles`}
          >
            <Star
              className={`h-8 w-8 transition-all duration-150 ${
                filled
                  ? 'scale-105 fill-brand-500 text-brand-500 dark:fill-brand-400 dark:text-brand-400'
                  : 'fill-transparent text-slate-300 dark:text-slate-700'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

export default function AvisPage() {
  const { language } = useLanguage();
  const t = useTranslations('avis');
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<Testimonial | null>(null);
  const [editing, setEditing] = useState(false);

  const [authorName, setAuthorName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);

  // TEMPORAIRE (demande du 17/09, "pour ce soir") : pas de redirection vers
  // /login pour un visiteur sans compte — voir la note dans
  // /api/testimonials POST pour le pourquoi et la date de retour en arrière
  // prévue. Un visiteur connecté garde le comportement normal (préremplissage
  // de son entreprise, avis existant retrouvable et modifiable) ; un
  // anonyme voit simplement un formulaire vide, sans "mine" possible.
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) { setLoading(false); return; }
      setUser(data.user);

      const { data: profileData } = await supabase
        .from('users')
        .select('company_name')
        .eq('id', data.user.id)
        .maybeSingle();

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/testimonials/mine', { headers: { Authorization: `Bearer ${token}` } });
      const result = await res.json().catch(() => ({}));
      const existing: Testimonial | null = result?.testimonial ?? null;
      setMine(existing);

      if (existing) {
        setAuthorName(existing.author_name);
        setCompanyName(existing.company_name ?? '');
        setRoleTitle(existing.role_title ?? '');
        setRating(existing.rating);
        setContent(existing.content);
      } else {
        setCompanyName(profileData?.company_name ?? '');
      }

      setLoading(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!authorName.trim() || !content.trim()) {
      setError(t.errors.missingFields);
      return;
    }
    if (content.trim().length < 20) {
      setError(t.errors.tooShort);
      return;
    }
    if (rating < 1) {
      setError(t.errors.noRating);
      return;
    }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/testimonials', {
        method: 'POST',
        headers,
        body: JSON.stringify({ authorName, companyName, roleTitle, rating, content, language }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error || t.errors.saveFailed);
        setSubmitting(false);
        return;
      }
      setMine((prev) => ({
        id: result.testimonial?.id ?? prev?.id ?? '',
        author_name: authorName,
        company_name: companyName || null,
        role_title: roleTitle || null,
        rating,
        content,
        status: 'approved',
      }));
      setEditing(false);
      setJustSubmitted(true);
      setSubmitting(false);
    } catch {
      setError(t.errors.saveFailed);
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navigation user={user} />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 dark:border-slate-700 dark:border-t-brand-500" />
        </div>
      </>
    );
  }

  const showForm = !mine || editing;

  return (
    <>
      <Navigation user={user} />
      <main className="relative mx-auto max-w-xl px-6 py-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-brand-50/60 to-transparent dark:from-brand-500/5" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">{t.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">{t.title}</h1>
          <p className="mt-4 text-slate-600 dark:text-slate-400">{t.subtitle}</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!showForm && mine ? (
            <motion.div
              key="status"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="mt-10 rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <Check className="h-7 w-7" />
              </div>

              <h2 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">{t.approvedTitle}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.approvedBody}</p>

              <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-left dark:bg-slate-800/60">
                <div className="mb-2 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < mine.rating ? 'fill-brand-500 text-brand-500 dark:fill-brand-400 dark:text-brand-400' : 'text-slate-300 dark:text-slate-700'}`} />
                  ))}
                </div>
                <p className="text-sm italic leading-relaxed text-slate-700 dark:text-slate-300">&ldquo;{mine.content}&rdquo;</p>
                <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {mine.author_name}{mine.company_name ? ` · ${mine.company_name}` : ''}{mine.role_title ? `, ${mine.role_title}` : ''}
                </p>
              </div>

              <button
                onClick={() => { setEditing(true); setJustSubmitted(false); }}
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-700"
              >
                <Pencil className="h-3.5 w-3.5" /> {t.editButton}
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="mt-10 rounded-3xl border border-slate-100 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              {justSubmitted && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-500/10 dark:text-emerald-400"
                >
                  <Check className="h-4 w-4 flex-shrink-0" /> {t.updateSuccess}
                </motion.div>
              )}

              <div className="flex flex-col items-center gap-2 border-b border-slate-100 pb-6 dark:border-slate-800">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.ratingLabel}</label>
                <StarPicker value={rating} onChange={setRating} />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">{t.nameLabel}</label>
                  <input
                    type="text"
                    required
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">{t.companyLabel}</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">{t.roleLabel}</label>
                <input
                  type="text"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder={t.rolePlaceholder}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.contentLabel}</label>
                  <span className={`text-xs ${content.length > CONTENT_MAX ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                    {content.length}/{CONTENT_MAX}
                  </span>
                </div>
                <textarea
                  rows={5}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, CONTENT_MAX))}
                  placeholder={t.contentPlaceholder}
                  className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60 dark:hover:bg-brand-500"
                >
                  {submitting ? t.submitting : <>{t.submit} <ArrowRight className="h-4 w-4" /></>}
                </button>
                {mine && editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-full px-5 py-3 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    {t.cancel}
                  </button>
                )}
              </div>
              <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">{t.publishNote}</p>
            </motion.form>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
