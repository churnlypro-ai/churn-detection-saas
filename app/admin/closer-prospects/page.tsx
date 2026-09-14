'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { XCircle, ArrowLeft, Upload, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';

export default function AdminCloserProspectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [unassignedCount, setUnassignedCount] = useState<number | null>(null);

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  const [assignCloserEmail, setAssignCloserEmail] = useState('');
  const [assignCount, setAssignCount] = useState('20');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignResult, setAssignResult] = useState('');

  const getAuthToken = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? '';
  }, []);

  const loadUnassignedCount = useCallback(async (authToken: string) => {
    const res = await fetch('/api/admin/closer-prospects/assign', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.ok) {
      const data = await res.json();
      setUnassignedCount(data.unassigned ?? 0);
    }
  }, []);

  const loadAdminStatus = useCallback(async (authToken: string) => {
    const res = await fetch('/api/admin/check', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.status === 403 || !res.ok) return 'forbidden' as const;
    const data = await res.json().catch(() => ({}));
    if (!data.isAdmin) return 'forbidden' as const;
    return 'ok' as const;
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
      await loadUnassignedCount(authToken);
      setLoading(false);
    });
  }, [router, getAuthToken, loadAdminStatus, loadUnassignedCount]);

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
        body: JSON.stringify({ files: encoded, assignedTo: assignedTo.trim() || null }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Import échoué.');
      const parts = [`${result.added} prospect${result.added !== 1 ? 's' : ''} ajouté${result.added !== 1 ? 's' : ''}`];
      if (result.skippedDuplicate) parts.push(`${result.skippedDuplicate} déjà présent${result.skippedDuplicate > 1 ? 's' : ''} (ignoré${result.skippedDuplicate > 1 ? 's' : ''})`);
      if (result.skippedInvalid) parts.push(`${result.skippedInvalid} sans numéro exploitable (ignoré${result.skippedInvalid > 1 ? 's' : ''})`);
      setImportResult(parts.join(' — '));
      await loadUnassignedCount(authToken);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import échoué.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setAssignError('');
    setAssignResult('');
    if (!assignCloserEmail.trim()) {
      setAssignError('Email du closer requis.');
      return;
    }
    setAssigning(true);
    try {
      const authToken = await getAuthToken();
      const res = await fetch('/api/admin/closer-prospects/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ closerEmail: assignCloserEmail.trim(), count: Number(assignCount) || 20 }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Assignation échouée.');
      setAssignResult(result.message || `${result.assigned} prospect${result.assigned !== 1 ? 's' : ''} assigné${result.assigned !== 1 ? 's' : ''} à ${assignCloserEmail.trim()}.`);
      await loadUnassignedCount(authToken);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Assignation échouée.');
    } finally {
      setAssigning(false);
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

        <h1 className="mt-4 mb-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Prospects (cold call)</h1>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          Chaque closer ne voit que ses propres prospects assignés sur <Link href="/closer" className="text-brand-600 hover:underline dark:text-brand-400">/closer</Link> — pas de file partagée.
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
              <input
                type="email"
                placeholder="Assigner directement à (email du closer) — laisse vide pour assigner plus tard"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
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

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Répartir les prospects non assignés</h2>
              </div>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                {unassignedCount === null ? 'Chargement…' : `${unassignedCount} prospect${unassignedCount !== 1 ? 's' : ''} en attente d'assignation.`}
              </p>
              <form onSubmit={handleAssign} className="flex flex-wrap items-end gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Email du closer</label>
                  <input
                    type="email"
                    placeholder="kendal@email.com"
                    value={assignCloserEmail}
                    onChange={(e) => setAssignCloserEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div className="w-28">
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Nombre</label>
                  <input
                    type="number"
                    min={1}
                    value={assignCount}
                    onChange={(e) => setAssignCount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={assigning}
                  className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {assigning ? 'Assignation…' : 'Assigner'}
                </button>
              </form>
              {assignError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{assignError}</p>}
              {assignResult && <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">{assignResult}</p>}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
