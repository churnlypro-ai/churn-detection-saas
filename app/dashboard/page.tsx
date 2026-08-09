'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';
import { AlertTriangle, Lock, X, Mail, Phone, Gift, GraduationCap, Zap, Check, TrendingDown, Users, Euro, BarChart3 } from 'lucide-react';
import { calcPrice, formatEuro as formatEuroShared } from '@/lib/pricing';

interface Profile {
  company_name: string;
  subscription_tier: string | null;
  subscription_status: string;
  client_count: number | null;
  monthly_revenue: number | null;
  industry: string | null;
  churn_rate: number | null;
}

interface AnalysisRow {
  id: string;
  client_name: string;
  revenue_monthly: number;
  churn_score: number;
  reason: string;
  solution: string;
}

interface UploadRow {
  id: string;
  upload_date: string;
  client_count: number;
}

interface ActionRow {
  id: string;
  client_name: string;
  action_type: string;
  completed: boolean;
  created_at: string;
}

function formatEuro(value: number): string {
  return formatEuroShared(value);
}

function riskBadge(score: number): { label: string; className: string } {
  if (score > 80) return { label: `${score}% Critique`, className: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' };
  if (score >= 60) return { label: `${score}% Risque`, className: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' };
  if (score >= 40) return { label: `${score}% Surveiller`, className: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400' };
  return { label: `${score}% Stable`, className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' };
}

const EMAIL_TEMPLATES = [
  { id: 'direct', label: 'Direct — Appel d\'urgence', icon: Zap, subject: 'On résout tes problèmes en 48h', tone: 'Professionnel + solution', forWho: 'Clients avec problèmes techniques' },
  { id: 'empathy', label: 'Empathie + Offre', icon: Gift, subject: 'Cadeau de notre côté', tone: 'Bienveillant + réduction €50 crédit', forWho: 'Clients déçus' },
  { id: 'audit', label: 'Audit gratuit', icon: BarChart3, subject: 'Diagnostic gratuit 30 min', tone: 'Consultant + valeur', forWho: 'Clients qui ne savent pas pourquoi partir' },
  { id: 'webinar', label: 'Webinaire + Support', icon: GraduationCap, subject: 'Masterclass gratuite jeudi 18h', tone: 'Éducation + communauté', forWho: 'Clients qui veulent apprendre' },
  { id: 'special', label: 'Offre spéciale urgente', icon: Mail, subject: '-€50 avant demain soir seulement', tone: 'Urgence + exclusivité', forWho: 'Clients indécis' },
];

function EmailModal({ client, onClose, onSent }: { client: AnalysisRow; onClose: () => void; onSent: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ subject: string; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function generateEmail(templateId: string) {
    setSelected(templateId);
    setGenerated(null);
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'generate_email', templateId, client }),
      });
      if (res.ok) {
        const data = await res.json();
        setGenerated({ subject: data.subject || '', body: data.body || '' });
      }
    } catch {
      // fallback
    }
    setLoading(false);
  }

  async function sendEmail() {
    if (!generated) return;
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: generated.subject, body: generated.body, clientName: client.client_name }),
      });
      setSent(true);
      onSent();
      setTimeout(onClose, 1500);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-5 top-5 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200">
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{client.client_name}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Score de churn: {client.churn_score}% · {formatEuro(client.revenue_monthly)}/mois</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{client.reason}</p>

        <div className="mt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Choisissez un template</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {EMAIL_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => generateEmail(tpl.id)}
                className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                  selected === tpl.id ? 'border-brand-400 bg-brand-50/50 shadow-sm dark:bg-brand-500/10' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                }`}
              >
                <tpl.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{tpl.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{tpl.subject}</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{tpl.forWho}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 dark:border-slate-700 dark:border-t-brand-500" />
              Génération de l'email personnalisé…
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {generated && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/60"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sujet</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{generated.subject}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Corps</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{generated.body}</p>
              <button
                onClick={sendEmail}
                disabled={sent}
                className="mt-5 flex items-center gap-2 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {sent ? <><Check className="h-4 w-4" /> Email envoyé</> : <><Mail className="h-4 w-4" /> Envoyer l'email</>}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function PaywallModal({
  atRisk,
  price,
  onClose,
  onSubscribe,
  loading,
  error,
}: {
  atRisk: number;
  price: number;
  onClose: () => void;
  onSubscribe: () => void;
  loading: boolean;
  error: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="relative w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-5 top-5 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200">
          <X className="h-5 w-5" />
        </button>
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
          <Lock className="h-8 w-8 text-amber-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{atRisk} client{atRisk > 1 ? 's' : ''} à risque détecté{atRisk > 1 ? 's' : ''}</h3>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Ces clients sont projetés au churn. Pour voir qui ils sont, pourquoi ils sont à risque,
          et comment les sauver — passez à Churnly Premium.
        </p>
        <div className="mt-6 rounded-2xl bg-gradient-to-b from-brand-50/60 to-white p-5 dark:from-brand-500/10 dark:to-slate-900">
          <p className="text-3xl font-extrabold text-brand-700 dark:text-brand-400">{formatEuro(price)}<span className="text-base font-medium text-slate-400 dark:text-slate-500">/mois</span></p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Annulable à tout moment</p>
        </div>
        <button
          onClick={onSubscribe}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60 dark:hover:bg-brand-500"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Redirection…
            </>
          ) : (
            'S\'abonner maintenant'
          )}
        </button>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button onClick={onClose} className="mt-3 text-xs text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300">
          Plus tard
        </button>
      </motion.div>
    </motion.div>
  );
}

function PaidClientTable({ clients, onEmailSent }: { clients: AnalysisRow[]; onEmailSent: () => void }) {
  const [emailClient, setEmailClient] = useState<AnalysisRow | null>(null);

  if (!clients.length) {
    return <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">Aucun client analysé pour l'instant.</div>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-semibold">Client</th>
              <th className="px-5 py-3 font-semibold">Revenue</th>
              <th className="px-5 py-3 font-semibold">Risque</th>
              <th className="px-5 py-3 font-semibold">Raison</th>
              <th className="px-5 py-3 font-semibold">Solution</th>
              <th className="px-5 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {clients.map((client) => {
              const badge = riskBadge(client.churn_score);
              return (
                <tr key={client.id} className="align-top transition hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">{client.client_name}</td>
                  <td className="px-5 py-4 text-slate-700 dark:text-slate-300">{formatEuro(client.revenue_monthly)}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                  </td>
                  <td className="max-w-[220px] px-5 py-4 text-slate-600 dark:text-slate-400">{client.reason}</td>
                  <td className="max-w-[240px] px-5 py-4 text-slate-600 dark:text-slate-400">{client.solution}</td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => setEmailClient(client)}
                      className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"
                    >
                      <Mail className="h-3.5 w-3.5" /> Envoyer un email
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {emailClient && (
          <EmailModal client={emailClient} onClose={() => setEmailClient(null)} onSent={onEmailSent} />
        )}
      </AnimatePresence>
    </>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; created_at?: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<AnalysisRow[]>([]);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [actionLog, setActionLog] = useState<ActionRow[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const loadData = useCallback(async (userId: string) => {
    const { data: results } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('user_id', userId)
      .order('analyzed_at', { ascending: false });

    const latestByClient = new Map<string, AnalysisRow>();
    for (const row of (results ?? []) as AnalysisRow[]) {
      if (!latestByClient.has(row.client_name)) latestByClient.set(row.client_name, row);
    }
    const latest = Array.from(latestByClient.values()).sort((a, b) => b.churn_score - a.churn_score);
    setClients(latest);

    const { data: uploadRows } = await supabase
      .from('csv_uploads')
      .select('*')
      .eq('user_id', userId)
      .order('upload_date', { ascending: false });
    setUploads((uploadRows ?? []) as UploadRow[]);

    const { data: actionRows } = await supabase
      .from('actions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setActionLog((actionRows ?? []) as ActionRow[]);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) { router.replace('/login'); return; }
      setUser(data.user);
      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      setProfile(profileData as Profile);
      await loadData(data.user.id);
      setLoading(false);

      const params = new URLSearchParams(window.location.search);
      if (params.get('checkout') === 'success') {
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 5000);
        window.history.replaceState({}, '', '/dashboard');
      }
    });
  }, [router, loadData]);

  async function handleSubscribe() {
    setCheckoutLoading(true);
    setCheckoutError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const tier = String(calcPrice(Number(profile?.client_count ?? 0), Number(profile?.monthly_revenue ?? 0), Number(profile?.churn_rate ?? 5)));

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier }),
      });

      if (!response.ok) throw new Error('Impossible de démarrer le paiement.');

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      setCheckoutLoading(false);
    }
  }

  const isSubscribed = profile?.subscription_status === 'active';

  const metrics = useMemo(() => {
    const clientCount = profile?.client_count ?? clients.length ?? 0;
    const mrr = profile?.monthly_revenue ?? clients.reduce((sum, c) => sum + (Number(c.revenue_monthly) || 0), 0);
    const churnRate = profile?.churn_rate ?? 0;
    const atRisk = Math.round((clientCount * churnRate) / 100);
    const ltv = clientCount ? mrr / clientCount : 0;
    return { mrr, churnRate, ltv, clientCount, atRisk };
  }, [clients, profile]);

  const chartData = useMemo(() => {
    const monthlyLoss = (metrics.mrr * metrics.churnRate) / 100;
    return Array.from({ length: 12 }, (_, i) => ({
      month: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'][i],
      revenue: Math.round(metrics.mrr - monthlyLoss * (i + 1)),
      loss: Math.round(monthlyLoss * (i + 1)),
    }));
  }, [metrics]);

  const riskDistribution = useMemo(() => {
    const buckets = [
      { range: 'Stable', count: 0, color: '#10b981' },
      { range: 'Surveiller', count: 0, color: '#fbbf24' },
      { range: 'Risque', count: 0, color: '#f97316' },
      { range: 'Critique', count: 0, color: '#ef4444' },
    ];
    for (const c of clients) {
      if (c.churn_score <= 25) buckets[0].count++;
      else if (c.churn_score <= 50) buckets[1].count++;
      else if (c.churn_score <= 75) buckets[2].count++;
      else buckets[3].count++;
    }
    return buckets;
  }, [clients]);

  const history = useMemo(() => {
    const events: { date: string; text: string }[] = [];
    for (const action of actionLog) {
      if (!action.completed) continue;
      events.push({ date: action.created_at, text: `Email envoyé à ${action.client_name}` });
    }
    for (const upload of uploads) {
      events.push({ date: upload.upload_date, text: `Données analysées (${upload.client_count} clients)` });
    }
    if (user?.created_at) events.push({ date: user.created_at, text: 'Compte créé' });
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);
  }, [actionLog, uploads, user]);

  if (loading) {
    return (
      <>
        <Navigation user={user} />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 dark:border-slate-700 dark:border-t-brand-500" />
        </div>
      </>
    );
  }

  if (!isSubscribed) {
    return (
      <>
        <Navigation user={user} />
        <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
            className="rounded-3xl border border-slate-100 bg-white p-12 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.2 }}
              className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10"
            >
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-5xl font-extrabold text-slate-900 dark:text-white"
            >
              {metrics.atRisk}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="mt-2 text-lg font-medium text-slate-600 dark:text-slate-400"
            >
              client{metrics.atRisk > 1 ? 's' : ''} à risque détecté{metrics.atRisk > 1 ? 's' : ''}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="mt-4 text-sm text-slate-500 dark:text-slate-400"
            >
              Sur vos {metrics.clientCount} clients, {metrics.atRisk} sont projetés au churn ({metrics.churnRate.toFixed(1)}%/mois).
            </motion.p>
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              onClick={() => setShowPaywall(true)}
              className="mt-8 rounded-full bg-brand-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700"
            >
              Voir les détails
            </motion.button>
          </motion.div>
        </main>

        <AnimatePresence>
          {showPaywall && (
            <PaywallModal
              atRisk={metrics.atRisk}
              price={calcPrice(Number(profile?.client_count ?? 0), Number(profile?.monthly_revenue ?? 0), Number(profile?.churn_rate ?? 5))}
              onClose={() => setShowPaywall(false)}
              onSubscribe={handleSubscribe}
              loading={checkoutLoading}
              error={checkoutError}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  const metricCards = [
    { label: 'MRR Total', value: formatEuro(metrics.mrr), icon: Euro, accent: 'text-slate-900 dark:text-white' },
    { label: 'Churn Rate', value: `${metrics.churnRate.toFixed(1)}%`, icon: TrendingDown, accent: 'text-red-500 dark:text-red-400' },
    { label: 'LTV Moyen', value: formatEuro(metrics.ltv), icon: Users, accent: 'text-slate-900 dark:text-white' },
    { label: 'Clients à risque', value: `${metrics.atRisk}`, icon: AlertTriangle, accent: 'text-amber-600 dark:text-amber-400' },
  ];

  return (
    <>
      <Navigation user={user} />
      <main className="relative mx-auto max-w-6xl space-y-8 px-6 py-10">

        <AnimatePresence>
          {showSuccessToast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg"
            >
              <Check className="h-4 w-4" /> Paiement réussi — bienvenue sur Churnly Premium
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }} className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{profile?.company_name || 'Dashboard'}</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Plan €{profile?.subscription_tier}/mois · Actif</p>
            </div>
          </div>
        </motion.div>

        <div className="relative z-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {metricCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: i * 0.1 }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{card.label}</p>
                <card.icon className={`h-4 w-4 ${card.accent}`} />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{card.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="relative z-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: EASE_OUT }} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Projection de revenue</h2>
            </div>
            <div className="h-[220px]">
              <ResponsiveRevenueChart data={chartData} />
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.15 }} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Distribution du risque</h2>
            </div>
            <div className="h-[220px]">
              <ResponsiveRiskChart data={riskDistribution} />
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }} className="relative z-10">
          <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Clients à risque</h2>
          <PaidClientTable clients={clients} onEmailSent={() => user && loadData(user.id)} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }} className="relative z-10">
          <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Historique</h2>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {history.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">Aucun événement pour l'instant.</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {history.map((event, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="w-24 shrink-0 text-slate-400 dark:text-slate-500">{new Date(event.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}</span>
                    <span>{event.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </main>
    </>
  );
}

function ResponsiveRevenueChart({ data }: { data: { month: string; revenue: number; loss: number }[] }) {
  const maxRev = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="flex h-full items-end gap-1">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-col items-center justify-end gap-0.5" style={{ height: '100%' }}>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(d.revenue / maxRev) * 100}%` }}
              transition={{ duration: 0.8, ease: EASE_OUT, delay: i * 0.05 }}
              className="w-full rounded-t bg-brand-500/80"
            />
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(d.loss / maxRev) * 100}%` }}
              transition={{ duration: 0.8, ease: EASE_OUT, delay: i * 0.05 + 0.1 }}
              className="w-full rounded-t bg-red-400/60"
            />
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

function ResponsiveRiskChart({ data }: { data: { range: string; count: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-full items-end justify-around gap-3">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-2">
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(d.count / max) * 80}%` }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: i * 0.1 }}
            className="w-full rounded-t-lg"
            style={{ backgroundColor: d.color, minHeight: d.count > 0 ? '8px' : '0' }}
          />
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{d.range}</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{d.count}</span>
        </div>
      ))}
    </div>
  );
}
