'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { XCircle, ArrowLeft, Upload, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
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
  assigned_to: string | null;
  created_at: string;
}

interface Counts {
  total: number;
  to_call: number;
  interested: number;
  callback: number;
  no_answer: number;
  not_interested: number;
  unassigned: number;
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

const INPUT_CLASS = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white';

interface EditDraft {
  name: string;
  companyName: string;
  phone: string;
  sector: string;
  status: ProspectStatus;
  calledBy: string;
  notes: string;
  assignedTo: string;
}

function toDraft(p: Prospect): EditDraft {
  return {
    name: p.name,
    companyName: p.company_name,
    phone: p.phone,
    sector: p.sector ?? '',
    status: p.status,
    calledBy: p.called_by ?? '',
    notes: p.notes ?? '',
    assignedTo: p.assigned_to ?? '',
  };
}

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
  const [assignedToFilter, setAssignedToFilter] = useState<string>('all');

  const [showAddForm, setShowAddForm] = useState(false);
  const [addDraft, setAddDraft] = useState<EditDraft>({ name: '', companyName: '', phone: '', sector: '', status: 'to_call', calledBy: '', notes: '', assignedTo: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const [assignEmail, setAssignEmail] = useState('');
  const [assignCount, setAssignCount] = useState('25');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignResult, setAssignResult] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function handleAddProspect(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError('');
    try {
      const authToken = await getAuthToken();
      const res = await fetch('/api/admin/closer-prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          name: addDraft.name,
          companyName: addDraft.companyName,
          phone: addDraft.phone,
          sector: addDraft.sector || null,
          status: addDraft.status,
          notes: addDraft.notes || null,
          calledBy: addDraft.calledBy || null,
          assignedTo: addDraft.assignedTo || null,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Ajout échoué.');
      setAddDraft({ name: '', companyName: '', phone: '', sector: '', status: 'to_call', calledBy: '', notes: '', assignedTo: '' });
      setShowAddForm(false);
      await loadProspects(authToken);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Ajout échoué.');
    } finally {
      setAdding(false);
    }
  }

  function startEdit(p: Prospect) {
    setEditingId(p.id);
    setEditDraft(toDraft(p));
    setEditError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
    setEditError('');
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;
    setSavingEdit(true);
    setEditError('');
    try {
      const authToken = await getAuthToken();
      const res = await fetch(`/api/admin/closer-prospects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          name: editDraft.name,
          companyName: editDraft.companyName,
          phone: editDraft.phone,
          sector: editDraft.sector || null,
          status: editDraft.status,
          calledBy: editDraft.calledBy || null,
          notes: editDraft.notes || null,
          assignedTo: editDraft.assignedTo || null,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Modification échouée.');
      setEditingId(null);
      setEditDraft(null);
      await loadProspects(authToken);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Modification échouée.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Supprimer ce prospect définitivement ?')) return;
    setDeletingId(id);
    try {
      const authToken = await getAuthToken();
      await fetch(`/api/admin/closer-prospects/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
      await loadProspects(authToken);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAssignBatch(e: React.FormEvent) {
    e.preventDefault();
    setAssigning(true);
    setAssignError('');
    setAssignResult('');
    try {
      const authToken = await getAuthToken();
      const res = await fetch('/api/admin/closer-prospects/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ assignee: assignEmail, count: Number(assignCount) }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Assignation échouée.');
      setAssignResult(result.message || `${result.assigned} prospect${result.assigned !== 1 ? 's' : ''} assigné${result.assigned !== 1 ? 's' : ''} à ${assignEmail}.`);
      await loadProspects(authToken);
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

  const assignees = Array.from(new Set(prospects.map((p) => p.assigned_to).filter((a): a is string => !!a))).sort();

  const filtered = prospects
    .filter((p) => statusFilter === 'all' || p.status === statusFilter)
    .filter((p) => {
      if (assignedToFilter === 'all') return true;
      if (assignedToFilter === 'unassigned') return !p.assigned_to;
      return p.assigned_to === assignedToFilter;
    });

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Admin
        </Link>

        <h1 className="mt-4 mb-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Prospects (cold call)</h1>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          File partagée entre tous les closers sur <Link href="/closer" className="text-brand-600 hover:underline dark:text-brand-400">/closer</Link> — tu importes ici, n&apos;importe quel closer appelle ce qui n&apos;a pas encore été traité. L&apos;assignation ci-dessous est optionnelle (ex: pour te réserver un lot précis) — elle ne conditionne plus ce qu&apos;un closer voit.
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

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setShowAddForm((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400"
              >
                <Plus className="h-4 w-4" /> Ajouter un prospect manuellement
              </button>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Pour un appel fait hors liste (ex: un closer a appelé quelqu&apos;un qui n&apos;était pas importé) — tu peux directement lui donner un résultat plutôt que &laquo;&nbsp;à appeler&nbsp;&raquo;.
              </p>
              {showAddForm && (
                <form onSubmit={handleAddProspect} className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <input required placeholder="Nom" value={addDraft.name} onChange={(e) => setAddDraft((d) => ({ ...d, name: e.target.value }))} className={INPUT_CLASS} />
                  <input required placeholder="Entreprise" value={addDraft.companyName} onChange={(e) => setAddDraft((d) => ({ ...d, companyName: e.target.value }))} className={INPUT_CLASS} />
                  <input required placeholder="Téléphone" value={addDraft.phone} onChange={(e) => setAddDraft((d) => ({ ...d, phone: e.target.value }))} className={INPUT_CLASS} />
                  <input placeholder="Secteur (optionnel)" value={addDraft.sector} onChange={(e) => setAddDraft((d) => ({ ...d, sector: e.target.value }))} className={INPUT_CLASS} />
                  <select value={addDraft.status} onChange={(e) => setAddDraft((d) => ({ ...d, status: e.target.value as ProspectStatus }))} className={INPUT_CLASS}>
                    {(Object.keys(STATUS_LABEL) as ProspectStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                  <input placeholder="Appelé par (email, si déjà appelé)" value={addDraft.calledBy} onChange={(e) => setAddDraft((d) => ({ ...d, calledBy: e.target.value }))} className={INPUT_CLASS} />
                  <input placeholder="Assigné à (email du closer, optionnel)" value={addDraft.assignedTo} onChange={(e) => setAddDraft((d) => ({ ...d, assignedTo: e.target.value }))} className={INPUT_CLASS} />
                  <input placeholder="Notes (optionnel)" value={addDraft.notes} onChange={(e) => setAddDraft((d) => ({ ...d, notes: e.target.value }))} className={`${INPUT_CLASS} sm:col-span-2`} />
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <button type="submit" disabled={adding} className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
                      {adding ? 'Ajout…' : 'Ajouter'}
                    </button>
                    <button type="button" onClick={() => setShowAddForm(false)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Annuler</button>
                  </div>
                  {addError && <p className="text-xs text-red-600 dark:text-red-400 sm:col-span-2">{addError}</p>}
                </form>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-1 flex items-center gap-2">
                <Check className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Assigner un lot</h2>
              </div>
              <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
                Optionnel — n&apos;importe quel closer voit toute la file de toute façon. Sert juste à noter qui doit prioriser quoi. Prend les N prospects &laquo;&nbsp;à appeler&nbsp;&raquo; les plus anciens qui ne sont pas encore assignés, et les donne à cet email.
                {counts ? ` ${counts.unassigned} non assigné${counts.unassigned !== 1 ? 's' : ''} actuellement.` : ''}
              </p>
              <form onSubmit={handleAssignBatch} className="flex flex-wrap items-center gap-2.5">
                <input
                  required
                  type="email"
                  placeholder="Email du closer"
                  value={assignEmail}
                  onChange={(e) => setAssignEmail(e.target.value)}
                  className={`${INPUT_CLASS} max-w-xs`}
                />
                <input
                  required
                  type="number"
                  min={1}
                  max={500}
                  placeholder="Nombre"
                  value={assignCount}
                  onChange={(e) => setAssignCount(e.target.value)}
                  className={`${INPUT_CLASS} w-24`}
                />
                <button type="submit" disabled={assigning} className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
                  {assigning ? 'Assignation…' : 'Assigner'}
                </button>
              </form>
              {assignError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{assignError}</p>}
              {assignResult && <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">{assignResult}</p>}
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

            {assignees.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-400 dark:text-slate-500">Assigné à</label>
                <select
                  value={assignedToFilter}
                  onChange={(e) => setAssignedToFilter(e.target.value)}
                  className={`${INPUT_CLASS} w-auto`}
                >
                  <option value="all">Tous</option>
                  <option value="unassigned">Non assigné</option>
                  {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
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
                        <th className="px-4 py-3">Assigné à</th>
                        <th className="px-4 py-3">Appelé par</th>
                        <th className="px-4 py-3">Appelé le</th>
                        <th className="px-4 py-3">Notes</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {filtered.map((p) => {
                        const isEditing = editingId === p.id && editDraft;
                        if (isEditing && editDraft) {
                          return (
                            <tr key={p.id} className="bg-brand-50/30 dark:bg-brand-500/5">
                              <td className="px-4 py-2"><input value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} className={INPUT_CLASS} /></td>
                              <td className="px-4 py-2"><input value={editDraft.companyName} onChange={(e) => setEditDraft({ ...editDraft, companyName: e.target.value })} className={INPUT_CLASS} /></td>
                              <td className="px-4 py-2"><input value={editDraft.phone} onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })} className={INPUT_CLASS} /></td>
                              <td className="px-4 py-2"><input value={editDraft.sector} onChange={(e) => setEditDraft({ ...editDraft, sector: e.target.value })} className={INPUT_CLASS} /></td>
                              <td className="px-4 py-2">
                                <select value={editDraft.status} onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value as ProspectStatus })} className={INPUT_CLASS}>
                                  {(Object.keys(STATUS_LABEL) as ProspectStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                                </select>
                              </td>
                              <td className="px-4 py-2"><input placeholder="email du closer" value={editDraft.assignedTo} onChange={(e) => setEditDraft({ ...editDraft, assignedTo: e.target.value })} className={INPUT_CLASS} /></td>
                              <td className="px-4 py-2"><input value={editDraft.calledBy} onChange={(e) => setEditDraft({ ...editDraft, calledBy: e.target.value })} className={INPUT_CLASS} /></td>
                              <td className="px-4 py-2 text-xs text-slate-400">—</td>
                              <td className="px-4 py-2"><input value={editDraft.notes} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} className={INPUT_CLASS} /></td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => saveEdit(p.id)} disabled={savingEdit} aria-label="Enregistrer" className="text-emerald-600 hover:text-emerald-700 disabled:opacity-60">
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button onClick={cancelEdit} aria-label="Annuler" className="text-slate-400 hover:text-slate-600">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                {editError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{editError}</p>}
                              </td>
                            </tr>
                          );
                        }
                        return (
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
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.assigned_to || '—'}</td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.called_by || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                              {p.called_at ? new Date(p.called_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td className="max-w-xs truncate px-4 py-3 text-slate-500 dark:text-slate-400" title={p.notes ?? ''}>{p.notes || '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => startEdit(p)} aria-label="Éditer" className="text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id} aria-label="Supprimer" className="text-slate-400 hover:text-red-500 disabled:opacity-60">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
