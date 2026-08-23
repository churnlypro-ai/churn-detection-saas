'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, PhoneCall } from 'lucide-react';
import { useLanguage, useTranslations } from '@/lib/i18n/LanguageContext';

interface CallBookingModalProps {
  open: boolean;
  onClose: () => void;
}

export function CallBookingModal({ open, onClose }: CallBookingModalProps) {
  const t = useTranslations('callBooking');
  const { language } = useLanguage();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [availability, setAvailability] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleClose() {
    onClose();
    // Laisse l'animation de sortie se jouer avant de vider le formulaire —
    // sinon l'utilisateur voit le contenu se réinitialiser pendant le fondu.
    setTimeout(() => {
      setName('');
      setEmail('');
      setCompanyName('');
      setAvailability('');
      setError('');
      setSuccess(false);
    }, 300);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !availability.trim()) {
      setError(t.errorMissingFields);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/call-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, companyName, availability, language }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || t.errorGeneric);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-7 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-5 flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-500/10">
                  <PhoneCall className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.modalTitle}</h2>
              </div>
              <button
                onClick={handleClose}
                className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={t.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {success ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
                <p className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{t.successTitle}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.successBody}</p>
                <button
                  onClick={handleClose}
                  className="mt-6 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  {t.close}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">{t.modalSubtitle}</p>
                <input
                  type="text"
                  placeholder={t.nameLabel}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <input
                  type="email"
                  placeholder={t.emailLabel}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <input
                  type="text"
                  placeholder={t.companyLabel}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">{t.availabilityLabel}</label>
                  <textarea
                    placeholder={t.availabilityPlaceholder}
                    required
                    rows={3}
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {submitting ? t.submitting : t.submit}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
