'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, PhoneCall } from 'lucide-react';
import { useLanguage, useTranslations } from '@/lib/i18n/LanguageContext';

interface CallBookingModalProps {
  open: boolean;
  onClose: () => void;
}

type ContactMethod = 'zoom' | 'video' | 'phone' | 'whatsapp' | 'email';

const PARIS_TZ = 'Europe/Paris';

function parisDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: PARIS_TZ });
}

export function CallBookingModal({ open, onClose }: CallBookingModalProps) {
  const t = useTranslations('callBooking');
  const { language } = useLanguage();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [notes, setNotes] = useState('');
  const [contactMethod, setContactMethod] = useState<ContactMethod>('zoom');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Chargé à chaque ouverture plutôt qu'une fois pour toutes — un visiteur
  // qui a laissé la page ouverte longtemps ne doit pas se voir proposer un
  // créneau déjà pris entre-temps par quelqu'un d'autre.
  useEffect(() => {
    if (!open) return;
    setSlotsLoading(true);
    setSlotsError(false);
    fetch('/api/available-slots')
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlotsError(true))
      .finally(() => setSlotsLoading(false));
  }, [open]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const iso of slots) {
      const key = parisDateKey(iso);
      const arr = map.get(key) ?? [];
      arr.push(iso);
      map.set(key, arr);
    }
    return map;
  }, [slots]);

  const availableDates = useMemo(() => Array.from(slotsByDate.keys()), [slotsByDate]);

  useEffect(() => {
    if (!selectedDate && availableDates.length > 0) setSelectedDate(availableDates[0]);
  }, [availableDates, selectedDate]);

  function handleClose() {
    onClose();
    // Laisse l'animation de sortie se jouer avant de vider le formulaire —
    // sinon l'utilisateur voit le contenu se réinitialiser pendant le fondu.
    setTimeout(() => {
      setName('');
      setEmail('');
      setCompanyName('');
      setNotes('');
      setContactMethod('zoom');
      setPhoneNumber('');
      setSelectedDate(null);
      setSelectedSlot(null);
      setError('');
      setSuccess(false);
    }, 300);
  }

  // La base attend un champ "availability" en texte libre en plus du
  // timestamp exact (slot_start) — voir /api/call-bookings : le texte reste
  // ce que l'équipe lit d'un coup d'œil, le timestamp sert à bloquer le
  // créneau pour qu'il ne soit plus proposé à quelqu'un d'autre.
  function formatAvailability(): string {
    if (!selectedSlot) return '';
    const formattedDate = new Date(selectedSlot).toLocaleString(
      language === 'en' ? 'en-US' : 'fr-FR',
      { timeZone: PARIS_TZ, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' },
    );
    const base = language === 'en' ? `${formattedDate} (Paris time)` : `${formattedDate} (heure de Paris)`;
    const withNotes = notes.trim() ? `${base} — ${notes.trim()}` : base;

    const contactLabels: Record<ContactMethod, string> = {
      zoom: t.contactZoom,
      video: t.contactVideo,
      phone: t.contactPhone,
      whatsapp: t.contactWhatsapp,
      email: t.contactEmail,
    };
    const requiresPhone = contactMethod === 'phone' || contactMethod === 'whatsapp';
    const contactLine = requiresPhone
      ? (language === 'en'
        ? `Contact: ${contactLabels[contactMethod]} (${phoneNumber.trim()})`
        : `Contact : ${contactLabels[contactMethod]} (${phoneNumber.trim()})`)
      : (language === 'en' ? `Contact: ${contactLabels[contactMethod]}` : `Contact : ${contactLabels[contactMethod]}`);

    return `${withNotes}\n${contactLine}`;
  }

  const requiresPhone = contactMethod === 'phone' || contactMethod === 'whatsapp';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !selectedSlot || (requiresPhone && !phoneNumber.trim())) {
      setError(t.errorMissingFields);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/call-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, companyName, availability: formatAvailability(), slotStart: selectedSlot, language }),
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
                  {slotsLoading ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500">{t.slotsLoading}</p>
                  ) : slotsError || availableDates.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500">{t.noSlotsAvailable}</p>
                  ) : (
                    <>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {availableDates.map((dateKey) => {
                          const label = new Date(`${dateKey}T12:00:00`).toLocaleDateString(
                            language === 'en' ? 'en-US' : 'fr-FR',
                            { timeZone: PARIS_TZ, weekday: 'short', day: 'numeric', month: 'short' },
                          );
                          return (
                            <button
                              key={dateKey}
                              type="button"
                              onClick={() => { setSelectedDate(dateKey); setSelectedSlot(null); }}
                              className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                                selectedDate === dateKey
                                  ? 'border-brand-600 bg-brand-600 text-white'
                                  : 'border-slate-200 text-slate-600 hover:border-brand-300 dark:border-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {(slotsByDate.get(selectedDate ?? '') ?? []).map((iso) => {
                          const label = new Date(iso).toLocaleTimeString(language === 'en' ? 'en-US' : 'fr-FR', {
                            timeZone: PARIS_TZ, hour: '2-digit', minute: '2-digit',
                          });
                          return (
                            <button
                              key={iso}
                              type="button"
                              onClick={() => setSelectedSlot(iso)}
                              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                                selectedSlot === iso
                                  ? 'border-brand-600 bg-brand-600 text-white'
                                  : 'border-slate-200 text-slate-600 hover:border-brand-300 dark:border-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
                <textarea
                  placeholder={t.availabilityPlaceholder}
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">{t.contactMethodLabel}</label>
                  <div className="flex flex-wrap gap-2">
                    {(['zoom', 'video', 'phone', 'whatsapp', 'email'] as ContactMethod[]).map((method) => {
                      const labels: Record<ContactMethod, string> = {
                        zoom: t.contactZoom,
                        video: t.contactVideo,
                        phone: t.contactPhone,
                        whatsapp: t.contactWhatsapp,
                        email: t.contactEmail,
                      };
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setContactMethod(method)}
                          className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                            contactMethod === method
                              ? 'border-brand-600 bg-brand-600 text-white'
                              : 'border-slate-200 text-slate-600 hover:border-brand-300 dark:border-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {labels[method]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {requiresPhone && (
                  <input
                    type="tel"
                    placeholder={t.phoneNumberPlaceholder}
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                )}
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting || !selectedSlot}
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
