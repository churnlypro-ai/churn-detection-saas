'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { useTranslations } from '@/lib/i18n/LanguageContext';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sliding, setSliding] = useState(false);
  const [accountExists, setAccountExists] = useState(false);
  const [magicLinkStatus, setMagicLinkStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [teamInviteError, setTeamInviteError] = useState(false);
  const t = useTranslations('login');

  // Un compte créé via "S'inscrire avec Stripe" n'a jamais de mot de passe —
  // ce lien de retour (voir signup-callback) doit donc proposer une autre
  // porte d'entrée que le formulaire mot de passe classique.
  useEffect(() => {
    if (searchParams.get('stripe') === 'account_exists') {
      setAccountExists(true);
      const prefill = searchParams.get('email');
      if (prefill) setEmail(prefill);
    }
    // Retour depuis /api/team/accept (voir cette route) : le lien
    // d'invitation était invalide, expiré, ou déjà utilisé.
    if (searchParams.get('team') === 'invalid' || searchParams.get('team') === 'error') {
      setTeamInviteError(true);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setSliding(true);

    setTimeout(() => {
      router.push('/dashboard');
    }, 700);
  }

  async function handleMagicLink() {
    if (!email) return;
    setMagicLinkStatus('sending');
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setMagicLinkStatus(otpError ? 'error' : 'sent');
  }

  return (
    <>
      <Navigation user={null} />

      <main className="relative flex min-h-[calc(100vh-73px)] items-center justify-center overflow-hidden px-6">
        <motion.div
          initial={{ opacity: 0, y: 24, rotateX: -8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ perspective: 1200 }}
          className="relative z-10 w-full max-w-sm"
        >
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t.title}</h1>
          <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>

          {teamInviteError && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-500/10 dark:text-amber-400">
              {t.teamInviteError}
            </div>
          )}

          {accountExists && (
            <div className="mb-6 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-800 dark:border-brand-800/40 dark:bg-brand-500/5 dark:text-brand-300">
              <p>{t.stripeAccountExists}</p>
              {magicLinkStatus === 'sent' ? (
                <p className="mt-2 font-medium">{t.magicLinkSent}</p>
              ) : (
                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={magicLinkStatus === 'sending' || !email}
                  className="mt-3 rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {magicLinkStatus === 'sending' ? t.magicLinkSending : t.magicLinkButton}
                </button>
              )}
              {magicLinkStatus === 'error' && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{t.magicLinkError}</p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.emailLabel}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                placeholder={t.emailPlaceholder}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.passwordLabel}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-600"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={loading || sliding}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? t.connecting : sliding ? t.welcoming : t.submit}
            </motion.button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {t.noAccount}{' '}
            <Link href="/signup" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              {t.createAccount}
            </Link>
          </p>
        </motion.div>

        <AnimatePresence>
          {sliding && (
            <motion.div
              initial={{ x: '100%', skewX: -8 }}
              animate={{ x: 0, skewX: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-brand-600"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-center"
              >
                <p className="text-2xl font-bold text-white">Churnly</p>
                <p className="mt-2 text-sm text-brand-100">{t.redirecting}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
