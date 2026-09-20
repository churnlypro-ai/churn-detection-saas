'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { XCircle, ArrowLeft, Upload, Plus, Pencil, Trash2, Check, X, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';

type ProspectStatus = 'to_contact' | 'messaged' | 'replied' | 'interested' | 'not_interested';
type Platform = 'x' | 'instagram' | 'linkedin' | 'other';

interface Prospect {
  id: string;
  name: string;
  company_name: string;
  website: string | null;
  platform: Platform;
  handle: string | null;
  email: string | null;
  notes: string | null;
  suggested_message: string | null;
  status: ProspectStatus;
  contacted_by: string | null;
  contacted_at: string | null;
  created_at: string;
}

interface Counts {
  total: number;
  to_contact: number;
  messaged: number;
  replied: number;
  interested: number;
  not_interested: number;
}

const STATUS_LABEL: Record<ProspectStatus, string> = {
  to_contact: 'À contacter',
  messaged: 'DM envoyé',
  replied: 'A répondu',
  interested: 'Intéressé',
  not_interested: 'Pas intéressé',
};

const STATUS_BADGE: Record<ProspectStatus, string> = {
  to_contact: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400',
  messaged: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  replied: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  interested: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  not_interested: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
};

const PLATFORM_LABEL: Record<Platform, string> = {
  x: 'X',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  other: 'Autre',
};

const INPUT_CLASS = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white';

interface EditDraft {
  name: string;
  companyName: string;
  website: string;
  platform: Platform;
  handle: string;
  email: string;
  status: ProspectStatus;
  contactedBy: string;
  notes: string;
  suggestedMessage: string;
}

const EMPTY_DRAFT: EditDraft = { name: '', companyName: '', website: '', platform: 'x', handle: '', email: '', status: 'to_contact', contactedBy: '', notes: '', suggestedMessage: '' };

function toDraft(p: Prospect): EditDraft {
  return {
    name: p.name,
    companyName: p.company_name,
    website: p.website ?? '',
    platform: p.platform,
    handle: p.handle ?? '',
    email: p.email ?? '',
    status: p.status,
    contactedBy: p.contacted_by ?? '',
    notes: p.notes ?? '',
    suggestedMessage: p.suggested_message ?? '',
  };
}

export default function AdminSocialProspectsPage() {
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

  const [showAddForm, setShowAddForm] = useState(false);
  const [addDraft, setAddDraft] = useState<EditDraft>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

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
    const res = await fetch('/api/admin/social-prospects', { headers: { Authorization: `Bearer ${authToken}` } });
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
      const res = await fetch('/api/admin/social-prospects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ files: encoded }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Import échoué.');
      const parts = [`${result.added} prospect${result.added !== 1 ? 's' : ''} ajouté${result.added !== 1 ? 's' : ''}`];
      if (result.skippedDuplicate) parts.push(`${result.skippedDuplicate} déjà présent${result.skippedDuplicate > 1 ? 's' : ''} (ignoré${result.skippedDuplicate > 1 ? 's' : ''})`);
      if (result.skippedInvalid) parts.push(`${result.skippedInvalid} sans site/identifiant exploitable (ignoré${result.skippedInvalid > 1 ? 's' : ''})`);
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
      const res = await fetch('/api/admin/social-prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          name: addDraft.name,
          companyName: addDraft.companyName,
          website: addDraft.website || null,
          platform: addDraft.platform,
          handle: addDraft.handle || null,
          email: addDraft.email || null,
          status: addDraft.status,
          notes: addDraft.notes || null,
          suggestedMessage: addDraft.suggestedMessage || null,
          contactedBy: addDraft.contactedBy || null,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Ajout échoué.');
      setAddDraft(EMPTY_DRAFT);
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
      const res = await fetch(`/api/admin/social-prospects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          name: editDraft.name,
          companyName: editDraft.companyName,
          website: editDraft.website || null,
          platform: editDraft.platform,
          handle: editDraft.handle || null,
          email: editDraft.email || null,
          status: editDraft.status,
          contactedBy: editDraft.contactedBy || null,
          notes: editDraft.notes || null,
          suggestedMessage: editDraft.suggestedMessage || null,
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
      await fetch(`/api/admin/social-prospects/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
      await loadProspects(authToken);
    } finally {
      setDeletingId(null);
    }
  }

  function copyMessage(p: Prospect) {
    if (!p.suggested_message) return;
    navigator.clipboard.writeText(p.suggested_message);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId((id) => (id === p.id ? null : id)), 2000);
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
      <main className="mx-auto max-w-6xl px-6 py-12">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Admin
        </Link>

        <h1 className="mt-4 mb-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Prospects réseaux sociaux</h1>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          Fondateurs trouvés via X/Instagram/LinkedIn plutôt que par téléphone — contact par DM, pas par appel. Le message suggéré se copie directement pour l&apos;envoyer.
        </p>

        {!loading && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-center gap-2">
                <Upload className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Importer un fichier</h2>
              </div>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                Colonnes reconnues (peu importe l&apos;ordre, français ou anglais) : <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">name</code>,{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">company_name</code>,{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">website</code>,{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">platform</code>,{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">handle</code>,{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">email</code>,{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">notes</code>,{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">suggested_message</code> (les 3 derniers optionnels).
              </p>
              <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
                Une ligne doit avoir au moins un site ou un identifiant réseau social — sinon ignorée, tout comme les doublons (même site ou même identifiant déjà présent).
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
              {showAddForm && (
                <form onSubmit={handleAddProspect} className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <input required placeholder="Nom" value={addDraft.name} onChange={(e) => setAddDraft((d) => ({ ...d, name: e.target.value }))} className={INPUT_CLASS} />
                  <input required placeholder="Produit / entreprise" value={addDraft.companyName} onChange={(e) => setAddDraft((d) => ({ ...d, companyName: e.target.value }))} className={INPUT_CLASS} />
                  <input placeholder="Site web" value={addDraft.website} onChange={(e) => setAddDraft((d) => ({ ...d, website: e.target.value }))} className={INPUT_CLASS} />
                  <div className="flex gap-2">
                    <select value={addDraft.platform} onChange={(e) => setAddDraft((d) => ({ ...d, platform: e.target.value as Platform }))} className={INPUT_CLASS}>
                      {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
                    </select>
                    <input placeholder="@handle" value={addDraft.handle} onChange={(e) => setAddDraft((d) => ({ ...d, handle: e.target.value }))} className={INPUT_CLASS} />
                  </div>
                  <input placeholder="Email (optionnel)" value={addDraft.email} onChange={(e) => setAddDraft((d) => ({ ...d, email: e.target.value }))} className={INPUT_CLASS} />
                  <select value={addDraft.status} onChange={(e) => setAddDraft((d) => ({ ...d, status: e.target.value as ProspectStatus }))} className={INPUT_CLASS}>
                    {(Object.keys(STATUS_LABEL) as ProspectStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                  <input placeholder="Notes (optionnel)" value={addDraft.notes} onChange={(e) => setAddDraft((d) => ({ ...d, notes: e.target.value }))} className={`${INPUT_CLASS} sm:col-span-2`} />
                  <textarea placeholder="Message suggéré (optionnel)" rows={3} value={addDraft.suggestedMessage} onChange={(e) => setAddDraft((d) => ({ ...d, suggestedMessage: e.target.value }))} className={`${INPUT_CLASS} sm:col-span-2 resize-none`} />
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

            {counts && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {([
                  ['all', 'Total', counts.total],
                  ['to_contact', STATUS_LABEL.to_contact, counts.to_contact],
                  ['messaged', STATUS_LABEL.messaged, counts.messaged],
                  ['replied', STATUS_LABEL.replied, counts.replied],
                  ['interested', STATUS_LABEL.interested, counts.interested],
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
                        <th className="px-4 py-3">Produit</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">Statut</th>
                        <th className="px-4 py-3">Message</th>
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
                              <td className="px-4 py-2 space-y-1">
                                <input placeholder="Site" value={editDraft.website} onChange={(e) => setEditDraft({ ...editDraft, website: e.target.value })} className={INPUT_CLASS} />
                                <div className="flex gap-1">
                                  <select value={editDraft.platform} onChange={(e) => setEditDraft({ ...editDraft, platform: e.target.value as Platform })} className={INPUT_CLASS}>
                                    {(Object.keys(PLATFORM_LABEL) as Platform[]).map((pl) => <option key={pl} value={pl}>{PLATFORM_LABEL[pl]}</option>)}
                                  </select>
                                  <input placeholder="@handle" value={editDraft.handle} onChange={(e) => setEditDraft({ ...editDraft, handle: e.target.value })} className={INPUT_CLASS} />
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <select value={editDraft.status} onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value as ProspectStatus })} className={INPUT_CLASS}>
                                  {(Object.keys(STATUS_LABEL) as ProspectStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                                </select>
                              </td>
                              <td className="px-4 py-2"><textarea rows={2} value={editDraft.suggestedMessage} onChange={(e) => setEditDraft({ ...editDraft, suggestedMessage: e.target.value })} className={`${INPUT_CLASS} resize-none`} /></td>
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
                        const isExpanded = expandedMessageId === p.id;
                        return (
                          <tr key={p.id}>
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{p.name}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                              {p.company_name}
                              {p.website && (
                                <a href={p.website.startsWith('http') ? p.website : `https://${p.website}`} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-brand-600 hover:underline dark:text-brand-400">
                                  {p.website}
                                </a>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">{PLATFORM_LABEL[p.platform]}</span>
                              {p.handle && <span className="ml-1.5">{p.handle}</span>}
                              {p.email && <span className="block text-xs">{p.email}</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[p.status]}`}>
                                {STATUS_LABEL[p.status]}
                              </span>
                            </td>
                            <td className="max-w-sm px-4 py-3 text-slate-500 dark:text-slate-400">
                              {p.suggested_message ? (
                                <div>
                                  <p className={isExpanded ? 'whitespace-pre-wrap' : 'truncate'}>{p.suggested_message}</p>
                                  <div className="mt-1 flex items-center gap-2">
                                    <button onClick={() => setExpandedMessageId(isExpanded ? null : p.id)} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
                                      {isExpanded ? 'Réduire' : 'Voir tout'}
                                    </button>
                                    <button onClick={() => copyMessage(p)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                                      <Copy className="h-3 w-3" /> {copiedId === p.id ? 'Copié !' : 'Copier'}
                                    </button>
                                  </div>
                                </div>
                              ) : '—'}
                            </td>
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
