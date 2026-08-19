'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { useLanguage, useTranslations } from '@/lib/i18n/LanguageContext';
import { resolveAccountIdClient } from '@/lib/team';

interface NormalizedRow {
  name: string;
  revenue_monthly: number;
  days_since_last_login: number;
  support_tickets_open: number;
  avg_session_duration_days: number;
  payment_status: string;
  renewal_date: string;
}

function UploadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [status, setStatus] = useState<'idle' | 'parsing' | 'analyzing' | 'error'>('idle');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<'idle' | 'connecting' | 'importing' | 'error'>('idle');
  const [stripeMessage, setStripeMessage] = useState('');
  const t = useTranslations('upload');
  const { language } = useLanguage();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) {
        router.replace('/login');
        return;
      }
      setUser(data.user);
      const accountId = await resolveAccountIdClient(supabase, data.user.id);
      supabase
        .from('users')
        .select('company_name, stripe_connect_account_id')
        .eq('id', accountId)
        .maybeSingle()
        .then(({ data: profile }) => {
          setCompanyName(profile?.company_name || '');
          setStripeConnected(!!profile?.stripe_connect_account_id);
        });
    });
  }, [router]);

  // Retour depuis l'écran d'autorisation Stripe : on lance l'import tout de
  // suite plutôt que de faire recliquer un bouton — connecter Stripe n'a
  // d'intérêt que si ça débouche immédiatement sur des données.
  useEffect(() => {
    const stripeParam = searchParams.get('stripe');
    if (!stripeParam) return;
    window.history.replaceState({}, '', '/upload');

    if (stripeParam === 'connected') {
      setStripeConnected(true);
      void handleImportFromStripe();
    } else if (stripeParam === 'denied') {
      setStripeMessage(t.stripeDenied);
    } else if (stripeParam === 'error') {
      setStripeMessage(t.stripeError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function normalizeRow(row: Record<string, string>): NormalizedRow & Record<string, unknown> {
    return {
      // Colonnes non reconnues (propres au métier de chaque client, ex:
      // jours depuis le dernier contenu publié, ancienneté, etc.) passent
      // telles quelles jusqu'à Claude plutôt que d'être perdues ici — le
      // prompt d'analyse est déjà conçu pour utiliser tout champ présent.
      ...row,
      name: row.name || row.client_name || row.Client || '',
      revenue_monthly: Number(row.revenue_monthly || row.revenue || 0),
      days_since_last_login: Number(row.days_since_last_login || row.days_inactive || 0),
      support_tickets_open: Number(row.support_tickets_open || row.open_tickets || 0),
      avg_session_duration_days: Number(row.avg_session_duration_days || 0),
      payment_status: row.payment_status || 'ok',
      renewal_date: row.renewal_date || row.next_renewal || row.subscription_end || row.renewal || row.contract_end || '',
    };
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStatus('parsing');
    setError('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const clients = results.data
          .map((row) => normalizeRow(row as Record<string, string>))
          .filter((c) => c.name);

        if (clients.length === 0) {
          setStatus('error');
          setError(t.errors.noValidRows);
          return;
        }

        setStatus('analyzing');

        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;

          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ clients, filename: file.name, language }),
          });

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || t.errors.analysisFailed);
          }

          const result = await response.json();
          router.push(`/preview?uploadId=${result.uploadId}`);
        } catch (err) {
          setStatus('error');
          setError(err instanceof Error ? err.message : t.errors.generic);
        }
      },
      error: () => {
        setStatus('error');
        setError(t.errors.cannotReadFile);
      },
    });
  }

  async function handleConnectStripe() {
    setStripeStatus('connecting');
    setStripeMessage('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch('/api/stripe/connect/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(t.stripeError);
      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setStripeStatus('error');
      setStripeMessage(err instanceof Error ? err.message : t.stripeError);
    }
  }

  async function handleImportFromStripe() {
    setStripeStatus('importing');
    setStripeMessage('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch('/api/stripe/connect/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ language }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || t.errors.stripeImportFailed);
      }
      const result = await response.json();
      router.push(`/preview?uploadId=${result.uploadId}`);
    } catch (err) {
      setStripeStatus('error');
      setStripeMessage(err instanceof Error ? err.message : t.errors.stripeImportFailed);
    }
  }

  if (!user) return null;

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t.welcome(companyName)}
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          {t.subtitle}
        </p>

        <label className="mt-10 flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-8 py-12 transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-brand-600 dark:hover:bg-brand-500/5">
          {(status === 'parsing' || status === 'analyzing') && (
            <Loader2 className="mb-1 h-6 w-6 animate-spin text-brand-500 dark:text-brand-400" />
          )}
          <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
            {status === 'parsing' || status === 'analyzing' ? t.processing : t.uploadCsv}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {fileName || t.columnsHint}
          </span>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFile}
            disabled={status === 'analyzing'}
          />
        </label>

        {status === 'analyzing' && (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" />
            </span>
            {t.analyzing}
          </p>
        )}
        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-8 flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
          <span className="h-px w-10 bg-slate-200 dark:bg-slate-700" />
          {t.or}
          <span className="h-px w-10 bg-slate-200 dark:bg-slate-700" />
        </div>

        <button
          type="button"
          onClick={stripeConnected ? handleImportFromStripe : handleConnectStripe}
          disabled={stripeStatus === 'connecting' || stripeStatus === 'importing'}
          className="mt-6 rounded-full border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:text-brand-400"
        >
          {stripeStatus === 'connecting'
            ? t.connectingStripe
            : stripeStatus === 'importing'
            ? t.importingStripe
            : stripeConnected
            ? t.importFromStripe
            : t.connectStripe}
        </button>
        {stripeMessage && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{stripeMessage}</p>
        )}
      </main>
    </>
  );
}

export default function Upload() {
  return (
    <Suspense fallback={null}>
      <UploadContent />
    </Suspense>
  );
}
