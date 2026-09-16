'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { XCircle, ArrowLeft, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';

type ProspectStatus = 'to_call' | 'interested' | 'not_interested' | 'no_answer' | 'callback';

interface Prospect {
  id: string;
  name: string;
  company_name: string;
  phone: string;
  sector: string | null;
  status: ProspectStatus;
  notes: string | null;
  called_by: string | null;
  called_at: string | null;
  created_at: string;
}

interface Counts {
  total: number;
  to_call: number;
  interested: number;
  callback: number;
  no_answer: number;
  not_interested: number;
}

const STATUS_LABEL: Record<ProspectStatus, string> = {
  to_call: 'À appeler',
  interested: 'Intéressé',
  callback: 'À rappeler',
  no_answer: 'Ne répond pas',
  not_interested: 'Pas intéressé',
};

const STATUS_BADGE: Record<ProspectStatus, string> = {
  to_call: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400',
  interested: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  callback: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  no_answer: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  not_interested: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
};

export default function AdminCloserProspectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState('');

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('all');

  const getAuthToken = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? '';
  }, []);

  const loadAdminStatus = useCallback(async (authToken: string) => {
    const res = await fetch('/api/admin/check', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.status === 403 || !res.ok) return 'forbidden' as const;
    const data = await res.json().catch(() => ({}));
    if (!data.isAdmin) return 'forbidden' as const;
    return 'ok' as const;
  }, []);

  const loadProspects = useCallback(async (authToken: string) => {
    const res = await fetch('/api/admin/closer-prospects', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.ok) {
      const result = await res.json();
      setProspects(result.prospects ?? []);
      setCounts(result.counts ?? null);
    }
  }, []);

  function readFileAsBase64(file: File): Promise<{ filename: string; contentBase64: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.slice(result.indexOf(',') + 1);
        resolve({ filename: file.name, contentBase64: base64 });
      };
      reader.onerror = () => reject(new Error('Lecture du fichier échouée.'));
      reader.readAsDataURL(file);
    });
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) { router.replace('/login'); return; }
      setUser(data.user);
      const authToken = await getAuthToken();
      const status = await loadAdminStatus(authToken);
      if (status === 'forbidden') { setForbidden(true); setLoading(false); return; }
      await loadProspects(authToken);
      setLoading(false);
    });
  }, [router, getAuthToken, loadAdminStatus, loadProspects]);

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setImporting(true);
    setImportError('');
    setImportResult('');
    try {
      const encoded = await Promise.all(Array.from(fileList).map(readFileAsBase64));
      const authToken = await getAuthToken();
      const res = await fetch('/api/admin/closer-prospects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ files: encoded }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Import échoué.');
      const parts = [`${result.added} prospect${result.added !== 1 ? 's' : ''} ajouté${result.added !== 1 ? 's' : ''}`];
      if (result.skippedDuplicate) parts.push(`${result.skippedDuplicate} déjà présent${result.skippedDuplicate > 1 ? 's' : ''} (ignoré${result.skippedDuplicate > 1 ? 's' : ''})`);
      if (result.skippedInvalid) parts.push(`${result.skippedInvalid} sans numéro exploitable (ignoré${result.skippedInvalid > 1 ? 's' : ''})`);
      setImportResult(parts.join(' — '));
      await loadProspects(authToken);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import échoué.');
    } finally {
      setImporting(false);
      e.target.value = '';
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

  const filtered = statusFilter === 'all' ? prospects : prospects.filter((p) => p.status === statusFilter);

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Admin
        </Link>

        <h1 className="mt-4 mb-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Prospects (cold call)</h1>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          File partagée entre tous les closers sur <Link href="/closer" className="text-brand-600 hover:underline dark:text-brand-400">/closer</Link> — tu importes ici, n&apos;importe quel closer appelle ce qui n&apos;a pas encore été traité.
        </p>

        {!loading && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-center gap-2">
                <Upload className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Importer un fichier</h2>
              </div>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                Colonnes reconnues (peu importe l&apos;ordre, français ou anglais) : <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">name</code>/<code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">nom</code>,{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">company_name</code>/<code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">entreprise</code>,{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">phone</code>/<code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">telephone</code>,{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">sector</code>/<code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">secteur</code> (optionnel).
              </p>
              <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
                Lignes sans numéro exploitable (moins de 8 chiffres) ou en doublon automatiquement ignorées.
              </p>
              <label className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-brand-700">
                <Upload className="h-5 w-5 text-brand-500" />
                <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                  {importing ? 'Import en cours…' : 'Choisir un fichier'}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">.csv, .xlsx, .xls</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileImport}
                  disabled={importing}
                />
              </label>
              {importError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{importError}</p>}
              {importResult && <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">{importResult}</p>}
            </div>

            {counts && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {([
                  ['all', 'Total', counts.total],
                  ['to_call', STATUS_LABEL.to_call, counts.to_call],
                  ['interested', STATUS_LABEL.interested, counts.interested],
                  ['callback', STATUS_LABEL.callback, counts.callback],
                  ['no_answer', STATUS_LABEL.no_answer, counts.no_answer],
                  ['not_interested', STATUS_LABEL.not_interested, counts.not_interested],
                ] as [ProspectStatus | 'all', string, number][]).map(([key, label, value]) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`rounded-2xl border px-4 py-3.5 text-left transition ${
                      statusFilter === key
                        ? 'border-brand-400 bg-brand-50/60 dark:border-brand-600 dark:bg-brand-500/10'
                        : 'border-slate-100 bg-white hover:border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                    }`}
                  >
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</p>
                    <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{value}</p>
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {filtered.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-slate-400 dark:text-slate-500">Aucun prospect.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-medium text-slate-400 dark:border-slate-800 dark:text-slate-500">
                        <th className="px-4 py-3">Nom</th>
                        <th className="px-4 py-3">Entreprise</th>
                        <th className="px-4 py-3">Téléphone</th>
                        <th className="px-4 py-3">Secteur</th>
                        <th className="px-4 py-3">Statut</th>
                        <th className="px-4 py-3">Appelé par</th>
                        <th className="px-4 py-3">Appelé le</th>
                        <th className="px-4 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {filtered.map((p) => (
                        <tr key={p.id}>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{p.name}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.company_name}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.phone}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.sector || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[p.status]}`}>
                              {STATUS_LABEL[p.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.called_by || '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                            {p.called_at ? new Date(p.called_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="max-w-xs truncate px-4 py-3 text-slate-500 dark:text-slate-400" title={p.notes ?? ''}>{p.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
