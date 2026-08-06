'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sliding, setSliding] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError('Email ou mot de passe incorrect.');
      setLoading(false);
      return;
    }

    setLoading(false);
    setSliding(true);

    setTimeout(() => {
      router.push('/dashboard');
    }, 700);
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
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Bon retour</h1>
          <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">Connectez-vous à votre compte.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                placeholder="vous@entreprise.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Mot de passe</label>
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
              {loading ? 'Connexion…' : sliding ? 'Bienvenue…' : 'Se connecter'}
            </motion.button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Pas encore de compte ?{' '}
            <Link href="/signup" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              Créer un compte
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
                <p className="mt-2 text-sm text-brand-100">Redirection vers votre dashboard…</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
