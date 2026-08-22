'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Send, Pencil, Plug, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage, useTranslations } from '@/lib/i18n/LanguageContext';
import { EASE_OUT } from '@/lib/animations';

interface DraftRow {
  id: string;
  client_name: string;
  client_email: string | null;
  template_id: string;
  subject: string;
  body: string;
  status: 'draft' | 'sent' | 'failed';
  error_message: string | null;
  sent_at: string | null;
  updated_at: string;
}

export default function RetentionDraftsPanel() {
  const t = useTranslations('dashboard').retentionDrafts;
  const { language } = useLanguage();

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [banner, setBanner] = useState('');

  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editClientEmail, setEditClientEmail] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState('');
  const [sendError, setSendError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Toujours relire la session au moment de l'appel plutôt qu'un token
  // capté une seule fois — voir le même correctif sur /admin/prospecting
  // (un token capté au chargement expire sur une page laissée ouverte
  // longtemps, alors que la session Supabase, elle, reste valide).
  const getAuthToken = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? '';
  }, []);

  const loadStatus = useCallback(async () => {
    const authToken = await getAuthToken();
    const res = await fetch('/api/gmail/status', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.ok) {
      const data = await res.json();
      setGmailConnected(data.connected);
      setGmailEmail(data.connectedEmail);
    }
  }, [getAuthToken]);

  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    const authToken = await getAuthToken();
    const res = await fetch(`/api/retention-drafts?language=${language}`, { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.ok) {
      const data = await res.json();
      setDrafts(data.drafts ?? []);
    }
    setLoadingDrafts(false);
  }, [getAuthToken, language]);

  useEffect(() => {
    loadStatus();
    loadDrafts();

    // Pas de useSearchParams() ici : ce composant vit dans une page déjà
    // statiquement pré-rendue, lire directement l'URL évite d'imposer une
    // frontière Suspense supplémentaire juste pour ce petit bandeau.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const gmailParam = params.get('gmail');
      if (gmailParam === 'connected') setBanner(t.connectedSuccess);
      else if (gmailParam === 'error') {
        const reason = params.get('reason');
        setBanner(reason ? `${t.connectBanner.title} : ${reason}` : '');
      }
      if (gmailParam) window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnect() {
    setConnecting(true);
    try {
      const authToken = await getAuthToken();
      const res = await fetch('/api/gmail/connect', { headers: { Authorization: `Bearer ${authToken}` } });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    const authToken = await getAuthToken();
    await fetch('/api/gmail/disconnect', { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } });
    setGmailConnected(false);
    setGmailEmail(null);
  }

  function startEdit(draft: DraftRow) {
    setEditingId(draft.id);
    setEditSubject(draft.subject);
    setEditBody(draft.body);
    setEditClientEmail(draft.client_email ?? '');
    setEditError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError('');
  }

  async function saveEdit(id: string) {
    setEditSaving(true);
    setEditError('');
    try {
      const authToken = await getAuthToken();
      const res = await fetch(`/api/retention-drafts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ subject: editSubject, body: editBody, clientEmail: editClientEmail }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Échec.');
      setEditingId(null);
      await loadDrafts();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Échec.');
    } finally {
      setEditSaving(false);
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
    const sendableIds = pendingDrafts.filter((d) => !!d.client_email).map((d) => d.id);
    const allSelected = sendableIds.length > 0 && sendableIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(sendableIds));
  }

  async function handleSendAll() {
    setSending(true);
    setSendResult('');
    setSendError('');
    try {
      const authToken = await getAuthToken();
      const hasSelection = selectedIds.size > 0;
      const res = await fetch('/api/retention-drafts/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(hasSelection ? { ids: Array.from(selectedIds) } : {}),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Échec.');
      setSendResult(t.resultSummary(result.sent ?? 0, result.failed ?? 0));
      setSelectedIds(new Set());
      await loadDrafts();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Échec.');
    } finally {
      setSending(false);
    }
  }

  const pendingDrafts = drafts.filter((d) => d.status === 'draft');
  const sendableCount = pendingDrafts.filter((d) => !!d.client_email).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Mail className="h-4 w-4 text-brand-500" /> {t.title}
        </h2>
      </div>

      {banner && (
        <div className="mx-6 mt-4 flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-slate-700 dark:border-brand-800/60 dark:bg-brand-500/10 dark:text-slate-300">
          {banner}
          <button onClick={() => setBanner('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
        </div>
      )}

      {!gmailConnected ? (
        <div className="m-6 flex flex-col items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/50 p-5 dark:border-brand-800/40 dark:bg-brand-500/5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Plug className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-600 dark:text-brand-400" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.connectBanner.title}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.connectBanner.body}</p>
            </div>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex-shrink-0 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {connecting ? t.connectBanner.connecting : t.connectBanner.cta}
          </button>
        </div>
      ) : (
        <div className="mx-6 mt-4 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-800/50">
          <span className="text-slate-600 dark:text-slate-300">{t.connectedAs(gmailEmail ?? '')}</span>
          <button onClick={handleDisconnect} className="text-xs font-medium text-slate-400 hover:text-red-500 dark:text-slate-500">
            {t.disconnect}
          </button>
        </div>
      )}

      <div className="p-6">
        {loadingDrafts ? (
          <p className="text-sm text-slate-400">{t.loading}</p>
        ) : drafts.length === 0 ? (
          <p className="text-sm text-slate-400">{t.empty}</p>
        ) : (
          <div className="space-y-3">
            {gmailConnected && sendableCount > 0 && (
              <label className="flex cursor-pointer items-center gap-2 pb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={sendableCount > 0 && pendingDrafts.filter((d) => !!d.client_email).every((d) => selectedIds.has(d.id))}
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-400 dark:border-slate-600"
                />
                {t.selectAll}
              </label>
            )}
            {drafts.map((draft) => {
              const isEditing = editingId === draft.id;
              return (
                <div key={draft.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                  {isEditing ? (
                    <div className="space-y-2.5">
                      <input
                        type="email"
                        placeholder="email@client.com"
                        value={editClientEmail}
                        onChange={(e) => setEditClientEmail(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                      <input
                        type="text"
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                      <textarea
                        rows={5}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                      {editError && <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(draft.id)}
                          disabled={editSaving}
                          className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                        >
                          {editSaving ? '…' : t.save}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={editSaving}
                          className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      {draft.status === 'draft' && draft.client_email && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(draft.id)}
                          onChange={() => toggleSelect(draft.id)}
                          className="mt-1 h-3.5 w-3.5 flex-shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-400 dark:border-slate-600"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{draft.client_name}</p>
                        <p className="truncate text-xs text-slate-400 dark:text-slate-500">{draft.subject}</p>
                        {!draft.client_email && draft.status === 'draft' && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3" /> {t.noEmailHint}
                          </p>
                        )}
                        {draft.status === 'failed' && draft.error_message && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-red-500"><AlertTriangle className="h-3 w-3" /> {draft.error_message}</p>
                        )}
                      </div>
                      <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        draft.status === 'sent'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : draft.status === 'failed'
                            ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {draft.status === 'sent' && <CheckCircle2 className="h-3 w-3" />}
                        {draft.status === 'draft' && <Clock className="h-3 w-3" />}
                        {draft.status === 'failed' && <AlertTriangle className="h-3 w-3" />}
                        {draft.status === 'sent' ? t.statusSent : draft.status === 'failed' ? t.statusFailed : t.statusDraft}
                      </span>
                      {draft.status === 'draft' && (
                        <button onClick={() => startEdit(draft)} className="flex-shrink-0 text-slate-300 transition hover:text-brand-500 dark:text-slate-600" aria-label={t.edit}>
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {gmailConnected && pendingDrafts.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
            <button
              onClick={handleSendAll}
              disabled={sending || (selectedIds.size === 0 && sendableCount === 0)}
              className="flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {sending ? t.sending : selectedIds.size > 0 ? t.sendSelected(selectedIds.size) : t.sendAll(sendableCount)}
            </button>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{t.sendHelper}</p>
            {sendResult && <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">{sendResult}</p>}
            {sendError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{sendError}</p>}
          </div>
        )}
      </div>
    </motion.div>
  );
}
