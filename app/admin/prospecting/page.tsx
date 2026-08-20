'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, XCircle, Mail, CheckCircle2, Clock, AlertTriangle, Send, Trash2, Plug } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';

interface QueueEntry {
  id: string;
  company_name: string | null;
  recipient_email: string;
  subject: string;
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
  const [token, setToken] = useState('');

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

  const [batchCount, setBatchCount] = useState(8);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState('');
  const [sendError, setSendError] = useState('');

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

      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token ?? '';
      setToken(authToken);

      const check = await fetch('/api/admin/check', { headers: { Authorization: `Bearer ${authToken}` } })
        .then((r) => r.json()).catch(() => ({ isAdmin: false }));
      if (!check.isAdmin) { setForbidden(true); setLoading(false); return; }

      await Promise.all([loadStatus(authToken), loadQueue(authToken)]);
      setLoading(false);

      const gmailParam = searchParams.get('gmail');
      if (gmailParam === 'connected') setBanner('Gmail connecté avec succès.');
      else if (gmailParam === 'error') setBanner('La connexion Gmail a échoué — réessaie.');
      if (gmailParam) window.history.replaceState({}, '', '/admin/prospecting');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleConnectGmail() {
    setConnecting(true);
    try {
      const res = await fetch('/api/admin/gmail/connect', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setBanner('Impossible de démarrer la connexion Gmail.');
      setConnecting(false);
    }
  }

  async function handleDisconnectGmail() {
    await fetch('/api/admin/gmail/disconnect', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    setGmailConnected(false);
    setGmailEmail(null);
  }

  async function handleAddToQueue(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError('');
    try {
      const res = await fetch('/api/admin/prospecting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyName, recipientEmail, subject, emailBody }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Ajout échoué.');
      setCompanyName('');
      setRecipientEmail('');
      setSubject('');
      setEmailBody('');
      await loadQueue(token);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Ajout échoué.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    await fetch(`/api/admin/prospecting/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await loadQueue(token);
  }

  async function handleSendBatch() {
    setSending(true);
    setSendResult('');
    setSendError('');
    try {
      const res = await fetch('/api/admin/prospecting/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ count: batchCount }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Envoi échoué.');
      setSendResult(`${result.sent} envoyé${result.sent > 1 ? 's' : ''}${result.failed ? `, ${result.failed} échoué${result.failed > 1 ? 's' : ''}` : ''}.`);
      await loadQueue(token);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Envoi échoué.');
    } finally {
      setSending(false);
    }
  }

  const queuedCount = queue.filter((q) => q.status === 'queued').length;

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

            <form onSubmit={handleAddToQueue} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Ajouter un email à la file</h2>
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
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Envoyer le prochain lot <span className="text-slate-400 dark:text-slate-500">({queuedCount} en attente)</span>
                </h2>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={batchCount}
                    onChange={(e) => setBatchCount(Number(e.target.value))}
                    className="w-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <button
                    onClick={handleSendBatch}
                    disabled={sending || !gmailConnected || queuedCount === 0}
                    className="flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {sending ? 'Envoi en cours…' : 'Envoyer'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Envoi espacé (10-18s entre chaque) — un lot de 15 prend jusqu&apos;à ~4 minutes, ne quitte pas la page pendant l&apos;envoi.
              </p>
              {sendResult && <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">{sendResult}</p>}
              {sendError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{sendError}</p>}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">File d&apos;attente</h2>
              </div>
              {queue.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-slate-400 dark:text-slate-500">Aucun email pour l&apos;instant.</p>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {queue.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-4 px-6 py-3.5">
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
                        <button
                          onClick={() => handleRemove(entry.id)}
                          className="flex-shrink-0 text-slate-300 transition hover:text-red-500 dark:text-slate-600"
                          aria-label="Retirer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
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
