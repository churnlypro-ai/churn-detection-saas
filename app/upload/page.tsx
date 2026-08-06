'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';

interface NormalizedRow {
  name: string;
  revenue_monthly: number;
  days_since_last_login: number;
  support_tickets_open: number;
  avg_session_duration_days: number;
  payment_status: string;
}

export default function Upload() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [status, setStatus] = useState<'idle' | 'parsing' | 'analyzing' | 'error'>('idle');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        router.replace('/login');
        return;
      }
      setUser(data.user);
      supabase
        .from('users')
        .select('company_name')
        .eq('id', data.user.id)
        .maybeSingle()
        .then(({ data: profile }) => setCompanyName(profile?.company_name || ''));
    });
  }, [router]);

  function normalizeRow(row: Record<string, string>): NormalizedRow {
    return {
      name: row.name || row.client_name || row.Client || '',
      revenue_monthly: Number(row.revenue_monthly || row.revenue || 0),
      days_since_last_login: Number(row.days_since_last_login || row.days_inactive || 0),
      support_tickets_open: Number(row.support_tickets_open || row.open_tickets || 0),
      avg_session_duration_days: Number(row.avg_session_duration_days || 0),
      payment_status: row.payment_status || 'ok',
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
          setError('Aucune ligne valide trouvée dans le CSV. Vérifiez les colonnes (name, revenue_monthly, ...).');
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
            body: JSON.stringify({ clients, filename: file.name }),
          });

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || "L'analyse a échoué.");
          }

          const result = await response.json();
          router.push(`/preview?uploadId=${result.uploadId}`);
        } catch (err) {
          setStatus('error');
          setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
        }
      },
      error: () => {
        setStatus('error');
        setError('Impossible de lire ce fichier CSV.');
      },
    });
  }

  if (!user) return null;

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Bienvenue{companyName ? ` ${companyName}` : ''}
        </h1>
        <p className="mt-3 text-slate-600">
          Connectez vos données clients pour voir qui risque de partir.
        </p>

        <label className="mt-10 flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-8 py-12 transition hover:border-brand-300 hover:bg-brand-50/40">
          <span className="text-sm font-semibold text-brand-600">
            {status === 'parsing' || status === 'analyzing' ? 'Traitement en cours…' : 'Télécharger un CSV'}
          </span>
          <span className="text-xs text-slate-400">
            {fileName || 'name, revenue_monthly, days_since_last_login, support_tickets_open, payment_status'}
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
          <p className="mt-4 animate-pulse text-sm text-slate-500">Claude analyse vos clients…</p>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-8 flex items-center gap-4 text-xs text-slate-400">
          <span className="h-px w-10 bg-slate-200" />
          ou
          <span className="h-px w-10 bg-slate-200" />
        </div>

        <button
          type="button"
          disabled
          title="Bientôt disponible"
          className="mt-6 rounded-full border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-400"
        >
          Connecter Stripe (bientôt)
        </button>
      </main>
    </>
  );
}
