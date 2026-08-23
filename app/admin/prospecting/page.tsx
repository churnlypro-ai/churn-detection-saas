'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, XCircle, Mail, CheckCircle2, Clock, AlertTriangle, Send, Trash2, Plug, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';

type ImportLanguage = 'fr' | 'en' | 'es' | 'de' | 'pt';

const IMPORT_LANGUAGES: { value: ImportLanguage; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
];

interface QueueEntry {
  id: string;
  company_name: string | null;
  recipient_email: string;
  subject: string;
  body: string;
  status: 'queued' | 'sent' | 'failed';
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
}

const STATUS_STYLES: Record<QueueEntry['status'], string> = {
  queued: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  sent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  failed: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

const STATUS_LABELS: Record<QueueEntry['status'], string> = {
  queued: 'En attente',
  sent: 'Envoyé',
  failed: 'Échoué',
};

function ProspectingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<{ id?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [banner, setBanner] = useState('');

  const [queue, setQueue] = useState<QueueEntry[]>([]);

  const [companyName, setCompanyName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const [bulkText, setBulkText] = useState('');
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkResult, setBulkResult] = useState('');

  const [fileImporting, setFileImporting] = useState(false);
  const [fileImportError, setFileImportError] = useState('');
  const [fileImportResult, setFileImportResult] = useState('');

  // Correction de langue pour des brouillons déjà en file (rédigés dans la
  // mauvaise langue lors d'un import précédent) — sélection multiple +
  // une langue cible, voir handleRelanguage.
  const [relanguageTarget, setRelanguageTarget] = useState<ImportLanguage | ''>('');
  const [relanguaging, setRelanguaging] = useState(false);
  const [relanguageResult, setRelanguageResult] = useState('');
  const [relanguageError, setRelanguageError] = useState('');

  const [batchCount, setBatchCount] = useState(8);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState('');
  const [sendError, setSendError] = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCompany, setEditCompany] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Toujours relire la session au moment de l'appel plutôt que de garder un
  // token capté une seule fois au chargement de la page : sur une page
  // laissée ouverte longtemps, ce token capté expire alors que la session
  // Supabase, elle, reste valide (rafraîchie en arrière-plan) — on se
  // retrouvait avec un "Forbidden" sur des actions pourtant légitimes.
  const getAuthToken = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? '';
  }, []);

  const loadStatus = useCallback(async (authToken: string) => {
    const res = await fetch('/api/admin/gmail/status', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.ok) {
      const data = await res.json();
      setGmailConnected(data.connected);
      setGmailEmail(data.connectedEmail);
    }
  }, []);

  const loadQueue = useCallback(async (authToken: string) => {
    const res = await fetch('/api/admin/prospecting', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.ok) {
      const data = await res.json();
      setQueue(data.emails ?? []);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) { router.replace('/login'); return; }
      setUser(data.user);

      const authToken = await getAuthToken();

      const check = await fetch('/api/admin/check', { headers: { Authorization: `Bearer ${authToken}` } })
        .then((r) => r.json()).catch(() => ({ isAdmin: false }));
      if (!check.isAdmin) { setForbidden(true); setLoading(false); return; }

      await Promise.all([loadStatus(authToken), loadQueue(authToken)]);
      setLoading(false);

      const gmailParam = searchParams.get('gmail');
      if (gmailParam === 'connected') setBanner('Gmail connecté avec succès.');
      else if (gmailParam === 'error') {
        const reason = searchParams.get('reason');
        setBanner(reason ? `Connexion Gmail échouée : ${reason}` : 'La connexion Gmail a échoué — réessaie.');
      }
      if (gmailParam) window.history.replaceState({}, '', '/admin/prospecting');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleConnectGmail() {
    setConnecting(true);
    try {
      const authToken = await getAuthToken();
      const res = await fetch('/api/admin/gmail/connect', { headers: { Authorization: `Bearer ${authToken}` } });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setBanner('Impossible de démarrer la connexion Gmail.');
      setConnecting(false);
    }
  }

  async function handleDisconnectGmail() {
    const authToken = await getAuthToken();
    await fetch('/api/admin/gmail/disconnect', { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } });
    setGmailConnected(false);
    setGmailEmail(null);
  }

  async function handleAddToQueue(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError('');
    try {
      const authToken = await getAuthToken();
      const res = await fetch('/api/admin/prospecting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ companyName, recipientEmail, subject, emailBody }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Ajout échoué.');
      setCompanyName('');
      setRecipientEmail('');
      setSubject('');
      setEmailBody('');
      await loadQueue(authToken);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Ajout échoué.');
    } finally {
      setAdding(false);
    }
  }

  // Format volontairement pensé pour être écrit à la main (par moi ou par
  // toi) plutôt que du JSON strict : un bloc par prospect séparé par une
  // ligne "---", avec "body:" suivi du corps du mail sur autant de lignes
  // que nécessaire. Beaucoup plus lisible/robuste à coller que du JSON
  // quand le corps contient des guillemets, des sauts de ligne, des liens.
  function parseBulkBlocks(text: string): { companyName: string; recipientEmail: string; subject: string; emailBody: string }[] {
    const blocks = text.split(/^---$/m).map((b) => b.trim()).filter(Boolean);
    return blocks.map((block) => {
      const lines = block.split('\n');
      let companyName = '';
      let recipientEmail = '';
      let subject = '';
      const bodyLines: string[] = [];
      let inBody = false;
      for (const line of lines) {
        if (inBody) { bodyLines.push(line); continue; }
        if (line.toLowerCase().startsWith('company:')) companyName = line.slice(line.indexOf(':') + 1).trim();
        else if (line.toLowerCase().startsWith('email:')) recipientEmail = line.slice(line.indexOf(':') + 1).trim();
        else if (line.toLowerCase().startsWith('subject:')) subject = line.slice(line.indexOf(':') + 1).trim();
        else if (line.toLowerCase().startsWith('body:')) {
          inBody = true;
          const rest = line.slice(line.indexOf(':') + 1);
          if (rest.trim()) bodyLines.push(rest.trim());
        }
      }
      return { companyName, recipientEmail, subject, emailBody: bodyLines.join('\n').trim() };
    });
  }

  async function handleBulkAdd() {
    setBulkAdding(true);
    setBulkError('');
    setBulkResult('');
    try {
      const parsed = parseBulkBlocks(bulkText);
      if (parsed.length === 0) {
        setBulkError('Aucun bloc reconnu — vérifie le format (company: / email: / subject: / body: séparés par ---).');
        return;
      }
      const invalid = parsed.filter((p) => !p.recipientEmail || !p.subject || !p.emailBody);
      if (invalid.length > 0) {
        setBulkError(`${invalid.length} bloc(s) incomplet(s) (email/objet/corps manquant) — rien n'a été importé, corrige et réessaie.`);
        return;
      }

      const authToken = await getAuthToken();
      let added = 0;
      let failed = 0;
      for (const entry of parsed) {
        const res = await fetch('/api/admin/prospecting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({
            companyName: entry.companyName || null,
            recipientEmail: entry.recipientEmail,
            subject: entry.subject,
            emailBody: entry.emailBody,
          }),
        });
        if (res.ok) added += 1; else failed += 1;
      }
      setBulkResult(`${added} ajouté${added > 1 ? 's' : ''} à la file${failed ? `, ${failed} échoué${failed > 1 ? 's' : ''}` : ''}.`);
      if (added > 0) setBulkText('');
      await loadQueue(authToken);
    } catch {
      setBulkError('Import échoué.');
    } finally {
      setBulkAdding(false);
    }
  }

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

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setFileImporting(true);
    setFileImportError('');
    setFileImportResult('');
    try {
      const encoded = await Promise.all(Array.from(fileList).map(readFileAsBase64));
      const authToken = await getAuthToken();
      const res = await fetch('/api/admin/prospecting/import-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ files: encoded }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Import échoué.');
      const skippedText = result.skippedDuplicate
        ? ` (${result.skippedDuplicate} déjà dans la file ou déjà contacté${result.skippedDuplicate > 1 ? 's' : ''}, ignoré${result.skippedDuplicate > 1 ? 's' : ''})`
        : '';
      const breakdown: Record<string, number> = result.languageBreakdown ?? {};
      const breakdownText = Object.keys(breakdown).length
        ? ` — ${Object.entries(breakdown).map(([lang, count]) => `${IMPORT_LANGUAGES.find((l) => l.value === lang)?.label ?? lang}: ${count}`).join(', ')}`
        : '';
      setFileImportResult(`${result.added} prospect${result.added !== 1 ? 's' : ''} ajouté${result.added !== 1 ? 's' : ''} à la file (langue détectée automatiquement par entreprise)${breakdownText}${skippedText}.`);
      await loadQueue(authToken);
    } catch (err) {
      setFileImportError(err instanceof Error ? err.message : 'Import échoué.');
    } finally {
      setFileImporting(false);
      e.target.value = '';
    }
  }

  async function handleRelanguage() {
    if (!relanguageTarget || selectedIds.size === 0) return;
    setRelanguaging(true);
    setRelanguageError('');
    setRelanguageResult('');
    try {
      const authToken = await getAuthToken();
      const res = await fetch('/api/admin/prospecting/relanguage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ ids: Array.from(selectedIds), language: relanguageTarget }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Correction échouée.');
      setRelanguageResult(`${result.fixed} email${result.fixed !== 1 ? 's' : ''} corrigé${result.fixed !== 1 ? 's' : ''}.`);
      setSelectedIds(new Set());
      setRelanguageTarget('');
      await loadQueue(authToken);
    } catch (err) {
      setRelanguageError(err instanceof Error ? err.message : 'Correction échouée.');
    } finally {
      setRelanguaging(false);
    }
  }

  async function handleRemove(id: string) {
    const authToken = await getAuthToken();
    await fetch(`/api/admin/prospecting/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    await loadQueue(authToken);
  }

  const [deletingSelection, setDeletingSelection] = useState(false);

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Supprimer définitivement ${selectedIds.size} email${selectedIds.size > 1 ? 's' : ''} de la file ?`)) return;
    setDeletingSelection(true);
    try {
      const authToken = await getAuthToken();
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/admin/prospecting/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } })
        )
      );
      setSelectedIds(new Set());
      await loadQueue(authToken);
    } finally {
      setDeletingSelection(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const queuedIds = queue.filter((q) => q.status === 'queued').map((q) => q.id);
    const allSelected = queuedIds.length > 0 && queuedIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(queuedIds));
  }

  function startEdit(entry: QueueEntry) {
    setEditingId(entry.id);
    setEditCompany(entry.company_name ?? '');
    setEditEmail(entry.recipient_email);
    setEditSubject(entry.subject);
    setEditBody(entry.body);
    setEditError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError('');
  }

  async function handleSaveEdit(id: string) {
    setEditSaving(true);
    setEditError('');
    try {
      const authToken = await getAuthToken();
      const res = await fetch(`/api/admin/prospecting/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ companyName: editCompany, recipientEmail: editEmail, subject: editSubject, emailBody: editBody }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Modification échouée.');
      setEditingId(null);
      await loadQueue(authToken);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Modification échouée.');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleSendBatch() {
    setSending(true);
    setSendResult('');
    setSendError('');
    try {
      const authToken = await getAuthToken();
      const hasSelection = selectedIds.size > 0;
      const res = await fetch('/api/admin/prospecting/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(hasSelection ? { ids: Array.from(selectedIds) } : { count: batchCount }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Envoi échoué.');
      setSendResult(`${result.sent} envoyé${result.sent > 1 ? 's' : ''}${result.failed ? `, ${result.failed} échoué${result.failed > 1 ? 's' : ''}` : ''}.`);
      setSelectedIds(new Set());
      await loadQueue(authToken);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Envoi échoué.');
    } finally {
      setSending(false);
    }
  }

  const queuedCount = queue.filter((q) => q.status === 'queued').length;
  const queuedIds = queue.filter((q) => q.status === 'queued').map((q) => q.id);
  const allQueuedSelected = queuedIds.length > 0 && queuedIds.every((id) => selectedIds.has(id));

  if (forbidden) {
    return (
      <>
        <Navigation user={user} />
        <main className="mx-auto max-w-2xl px-6 py-24 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Accès refusé</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Cette page est réservée au compte ambassadeur.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/admin" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> Retour à la vue d&apos;ensemble
        </Link>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="mb-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          Prospection par email
        </motion.h1>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          Ajoute un email à la file, puis envoie-les par lots depuis churnly.pro@gmail.com — avec une pause entre chaque envoi pour rester crédible.
        </p>

        {loading ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : (
          <div className="space-y-8">
            {banner && (
              <div className="flex items-center justify-between rounded-2xl border border-brand-200 bg-brand-50 px-5 py-3 text-sm text-slate-700 dark:border-brand-800/60 dark:bg-brand-500/10 dark:text-slate-300">
                {banner}
                <button onClick={() => setBanner('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
              </div>
            )}

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Plug className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {gmailConnected ? 'Gmail connecté' : 'Gmail non connecté'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {gmailConnected ? gmailEmail : 'Connecte churnly.pro@gmail.com pour pouvoir envoyer.'}
                    </p>
                  </div>
                </div>
                {gmailConnected ? (
                  <button
                    onClick={handleDisconnectGmail}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Déconnecter
                  </button>
                ) : (
                  <button
                    onClick={handleConnectGmail}
                    disabled={connecting}
                    className="rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                  >
                    {connecting ? 'Redirection…' : 'Connecter Gmail'}
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Importer des fichiers (automatique)</h2>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                Dépose un ou plusieurs fichiers (.xlsx, .csv, .txt, .md) contenant tes prospects — Churnly extrait automatiquement chaque entreprise avec un email exploitable, déduit la langue à utiliser pour chacune (pays/ville/indices du fichier) et rédige l&apos;email de prospection à sa place, dans la bonne langue et dans le même style que d&apos;habitude. Aucune entreprise déjà présente dans la file (ou déjà contactée) n&apos;est ajoutée en double.
              </p>
              <label className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-8 text-center transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-brand-700">
                <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                  {fileImporting ? 'Extraction et rédaction en cours…' : 'Choisir des fichiers'}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">.xlsx, .csv, .txt, .md — plusieurs fichiers à la fois possibles</span>
                <input
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.csv,.txt,.md"
                  className="hidden"
                  onChange={handleFileImport}
                  disabled={fileImporting}
                />
              </label>
              {fileImporting && (
                <p className="mt-3 animate-pulse text-xs text-slate-400 dark:text-slate-500">
                  Peut prendre quelques minutes pour beaucoup de prospects — ne quitte pas la page.
                </p>
              )}
              {fileImportError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{fileImportError}</p>}
              {fileImportResult && <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">{fileImportResult}</p>}
            </div>

            <form onSubmit={handleAddToQueue} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Ajouter un email à la file (manuel)</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Entreprise (optionnel)"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <input
                  type="email"
                  placeholder="Email destinataire"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <input
                type="text"
                placeholder="Objet"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <textarea
                placeholder="Corps du mail"
                required
                rows={6}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              {addError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{addError}</p>}
              <button
                type="submit"
                disabled={adding}
                className="mt-4 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {adding ? 'Ajout…' : 'Ajouter à la file'}
              </button>
            </form>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Import en masse (texte déjà rédigé)</h2>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Pour des emails déjà rédigés à l&apos;avance (relances par exemple) : colle plusieurs prospects d&apos;un coup, un bloc par prospect séparé par une ligne <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">---</code> :
              </p>
              <pre className="mb-3 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">{`company: Alchie
email: pierre@alchie.fr
subject: Petite relance — Alchie
body:
Bonjour Pierre,
...
L'équipe Churnly
---
company: ...
email: ...
subject: ...
body:
...`}</pre>
              <textarea
                placeholder="Colle ici tes blocs de prospects…"
                rows={8}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-xs text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              {bulkError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{bulkError}</p>}
              {bulkResult && <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">{bulkResult}</p>}
              <button
                onClick={handleBulkAdd}
                disabled={bulkAdding || !bulkText.trim()}
                className="mt-3 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {bulkAdding ? 'Import…' : 'Importer en masse'}
              </button>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {selectedIds.size > 0 ? 'Envoyer la sélection' : 'Envoyer le prochain lot'}{' '}
                  <span className="text-slate-400 dark:text-slate-500">
                    ({selectedIds.size > 0 ? `${selectedIds.size} sélectionné${selectedIds.size > 1 ? 's' : ''}` : `${queuedCount} en attente`})
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  {selectedIds.size === 0 && (
                    <input
                      type="number"
                      min={1}
                      max={15}
                      value={batchCount}
                      onChange={(e) => setBatchCount(Number(e.target.value))}
                      className="w-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  )}
                  <button
                    onClick={handleSendBatch}
                    disabled={sending || !gmailConnected || (selectedIds.size === 0 && queuedCount === 0)}
                    className="flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {sending ? 'Envoi en cours…' : selectedIds.size > 0 ? `Envoyer la sélection (${selectedIds.size})` : 'Envoyer'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {selectedIds.size > 0
                  ? 'Coche des emails dans la file ci-dessous pour choisir précisément lesquels envoyer.'
                  : 'Aucune sélection : envoie les plus anciens de la file, dans la limite choisie. Coche des emails ci-dessous pour choisir précisément lesquels envoyer.'}
                {' '}Envoi espacé (10-18s entre chaque) — un lot de 15 prend jusqu&apos;à ~4 minutes, ne quitte pas la page pendant l&apos;envoi.
              </p>
              {sendResult && <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">{sendResult}</p>}
              {sendError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{sendError}</p>}
            </div>

            {selectedIds.size > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedIds.size} email{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={deletingSelection}
                    className="flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingSelection ? 'Suppression…' : `Supprimer la sélection (${selectedIds.size})`}
                  </button>
                </div>
                <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Corriger la langue de la sélection</h2>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  Pour des brouillons déjà en file rédigés dans la mauvaise langue : réécrit l&apos;objet et le corps des {selectedIds.size} email{selectedIds.size > 1 ? 's' : ''} coché{selectedIds.size > 1 ? 's' : ''} ci-dessous dans la langue choisie, en gardant le même message.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={relanguageTarget}
                    onChange={(e) => setRelanguageTarget(e.target.value as ImportLanguage)}
                    disabled={relanguaging}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="" disabled>— Choisir une langue —</option>
                    {IMPORT_LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleRelanguage}
                    disabled={relanguaging || !relanguageTarget}
                    className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                  >
                    {relanguaging ? 'Correction en cours…' : 'Corriger la langue'}
                  </button>
                </div>
                {relanguageResult && <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">{relanguageResult}</p>}
                {relanguageError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{relanguageError}</p>}
              </div>
            )}

            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">File d&apos;attente</h2>
                {queuedIds.length > 0 && (
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={allQueuedSelected}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-400 dark:border-slate-600"
                    />
                    Tout sélectionner
                  </label>
                )}
              </div>
              {queue.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-slate-400 dark:text-slate-500">Aucun email pour l&apos;instant.</p>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {queue.map((entry) => {
                    const isEditing = editingId === entry.id;
                    return (
                      <div key={entry.id} className="px-6 py-3.5">
                        {isEditing ? (
                          <div className="space-y-2.5">
                            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                              <input
                                type="text"
                                placeholder="Entreprise (optionnel)"
                                value={editCompany}
                                onChange={(e) => setEditCompany(e.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                              />
                              <input
                                type="email"
                                placeholder="Email destinataire"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                              />
                            </div>
                            <input
                              type="text"
                              placeholder="Objet"
                              value={editSubject}
                              onChange={(e) => setEditSubject(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                            <textarea
                              rows={5}
                              placeholder="Corps du mail"
                              value={editBody}
                              onChange={(e) => setEditBody(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                            {editError && <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSaveEdit(entry.id)}
                                disabled={editSaving}
                                className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                              >
                                {editSaving ? 'Enregistrement…' : 'Enregistrer'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={editSaving}
                                className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-4">
                            {entry.status === 'queued' && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(entry.id)}
                                onChange={() => toggleSelect(entry.id)}
                                className="h-3.5 w-3.5 flex-shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-400 dark:border-slate-600"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                                {entry.company_name || entry.recipient_email}
                              </p>
                              <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                                {entry.recipient_email} · {entry.subject}
                              </p>
                              {entry.error_message && (
                                <p className="mt-1 flex items-center gap-1 text-xs text-red-500"><AlertTriangle className="h-3 w-3" /> {entry.error_message}</p>
                              )}
                            </div>
                            <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[entry.status]}`}>
                              {entry.status === 'sent' && <CheckCircle2 className="h-3 w-3" />}
                              {entry.status === 'queued' && <Clock className="h-3 w-3" />}
                              {entry.status === 'failed' && <AlertTriangle className="h-3 w-3" />}
                              {STATUS_LABELS[entry.status]}
                            </span>
                            {entry.status === 'queued' && (
                              <div className="flex flex-shrink-0 items-center gap-3">
                                <button
                                  onClick={() => startEdit(entry)}
                                  className="text-slate-300 transition hover:text-brand-500 dark:text-slate-600"
                                  aria-label="Modifier"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleRemove(entry.id)}
                                  className="text-slate-300 transition hover:text-red-500 dark:text-slate-600"
                                  aria-label="Retirer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default function ProspectingPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <Mail className="h-6 w-6 animate-pulse text-slate-300" />
      </div>
    }>
      <ProspectingContent />
    </Suspense>
  );
}
