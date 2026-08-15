'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';
import {
  AlertTriangle, Lock, X, Mail, Gift, GraduationCap, Zap, Check, TrendingDown, Users, Euro,
  BarChart3, Clock, Sparkles, ShieldCheck, Target, ChevronDown, Info,
} from 'lucide-react';
import { formatEuro as formatEuroShared } from '@/lib/pricing';
import { useLanguage, useTranslations } from '@/lib/i18n/LanguageContext';
import type { Dictionary } from '@/lib/i18n/dictionaries/fr';

interface Profile {
  company_name: string;
  subscription_tier: string | null;
  subscription_status: string;
  client_count: number | null;
  monthly_revenue: number | null;
  industry: string | null;
  churn_rate: number | null;
  trial_end: string | null;
  trial_used: boolean | null;
}

interface RiskFactor {
  factor: string;
  evidence: string;
  weight: 'low' | 'medium' | 'high';
}

interface RecommendedAction {
  type: 'email' | 'call' | 'offer' | 'other';
  detail: string;
  expected_impact: string;
}

interface AnalysisRow {
  id: string;
  client_name: string;
  revenue_monthly: number;
  churn_score: number;
  reason: string;
  solution: string;
  confidence?: number | null;
  details?: { risk_factors: RiskFactor[]; recommended_actions: RecommendedAction[] } | null;
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

function riskBadge(score: number, t: Dictionary['dashboard']['riskBadge']): { label: string; className: string } {
  if (score > 80) return { label: t.critical(score), className: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' };
  if (score >= 60) return { label: t.atRisk(score), className: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' };
  if (score >= 40) return { label: t.watch(score), className: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400' };
  return { label: t.stable(score), className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' };
}

const INDUSTRY_BENCHMARK_RATES: Record<string, number> = {
  saas: 5,
  agency: 8,
  ecommerce: 10,
  manager: 15,
  other: 7,
};

const EMAIL_TEMPLATE_ICONS = [Zap, Gift, BarChart3, GraduationCap, Mail];

function EmailModal({ client, onClose, onSent }: { client: AnalysisRow; onClose: () => void; onSent: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ subject: string; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const t = useTranslations('dashboard');
  const EMAIL_TEMPLATES = t.emailTemplates.map((tpl, i) => ({ ...tpl, id: String(i), icon: EMAIL_TEMPLATE_ICONS[i] }));

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
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.emailModal.scoreLine(client.churn_score, formatEuro(client.revenue_monthly))}</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{client.reason}</p>

        <div className="mt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.emailModal.chooseTemplate}</p>
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
              {t.emailModal.generating}
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.emailModal.subjectLabel}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{generated.subject}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.emailModal.bodyLabel}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{generated.body}</p>
              <button
                onClick={sendEmail}
                disabled={sent}
                className="mt-5 flex items-center gap-2 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {sent ? <><Check className="h-4 w-4" /> {t.emailModal.sent}</> : <><Mail className="h-4 w-4" /> {t.emailModal.send}</>}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

const WEIGHT_STYLES: Record<RiskFactor['weight'], string> = {
  high: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

function ClientDetailRow({ client }: { client: AnalysisRow }) {
  const factors = client.details?.risk_factors ?? [];
  const actions = client.details?.recommended_actions ?? [];
  const t = useTranslations('dashboard').clientDetail;

  return (
    <tr className="bg-slate-50/60 dark:bg-slate-800/30">
      <td colSpan={6} className="px-5 py-5">
        {typeof client.confidence === 'number' && (
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            {t.confidenceLabel}<strong>{Math.round(client.confidence * 100)}%</strong>
            {client.confidence < 0.6 && t.lowConfidenceNote}
          </p>
        )}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.riskFactorsTitle}</p>
            {factors.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">{t.noDetails}</p>
            ) : (
              <ul className="space-y-2">
                {factors.map((f, i) => (
                  <li key={i} className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${WEIGHT_STYLES[f.weight]}`}>{f.weight}</span>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">{f.factor}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{f.evidence}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.recommendedActionsTitle}</p>
            {actions.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">{t.noActionsDetails}</p>
            ) : (
              <ul className="space-y-2">
                {actions.map((a, i) => (
                  <li key={i} className="rounded-xl border border-brand-100 bg-brand-50/40 p-3 dark:border-brand-800/40 dark:bg-brand-500/5">
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">{a.type}</span>
                    <p className="mt-1.5 text-xs font-medium text-slate-800 dark:text-slate-200">{a.detail}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{a.expected_impact}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function PaidClientTable({ clients, onEmailSent }: { clients: AnalysisRow[]; onEmailSent: () => void }) {
  const [emailClient, setEmailClient] = useState<AnalysisRow | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const t = useTranslations('dashboard');

  if (!clients.length) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        {t.table.empty}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-semibold">{t.table.columnClient}</th>
              <th className="px-5 py-3 font-semibold">{t.table.columnRevenue}</th>
              <th className="px-5 py-3 font-semibold">{t.table.columnRisk}</th>
              <th className="px-5 py-3 font-semibold">{t.table.columnReason}</th>
              <th className="px-5 py-3 font-semibold">{t.table.columnSolution}</th>
              <th className="px-5 py-3 font-semibold">{t.table.columnAction}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {clients.map((client) => {
              const badge = riskBadge(client.churn_score, t.riskBadge);
              const isExpanded = expandedId === client.id;
              const hasDetails = (client.details?.risk_factors?.length ?? 0) > 0 || (client.details?.recommended_actions?.length ?? 0) > 0;
              return (
                <Fragment key={client.id}>
                  <tr className="align-top transition hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">
                      <button
                        onClick={() => hasDetails && setExpandedId(isExpanded ? null : client.id)}
                        className={`text-left ${hasDetails ? 'underline decoration-dotted underline-offset-4 hover:text-brand-600 dark:hover:text-brand-400' : ''}`}
                        disabled={!hasDetails}
                      >
                        {client.client_name}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-slate-700 dark:text-slate-300">{formatEuro(client.revenue_monthly)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td className="max-w-[220px] px-5 py-4 text-slate-600 dark:text-slate-400">{client.reason}</td>
                    <td className="max-w-[240px] px-5 py-4 text-slate-600 dark:text-slate-400">{client.solution}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {hasDetails && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : client.id)}
                            className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:text-brand-400"
                          >
                            <Info className="h-3.5 w-3.5" /> {t.table.infoClient}
                          </button>
                        )}
                        <button
                          onClick={() => setEmailClient(client)}
                          className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"
                        >
                          <Mail className="h-3.5 w-3.5" /> {t.table.sendEmail}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && <ClientDetailRow client={client} />}
                </Fragment>
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

const TEASER_META = [
  { revenue: 1200, score: 82 },
  { revenue: 2400, score: 67 },
  { revenue: 890, score: 58 },
];

function LockedClientsTeaser({ atRisk, onSubscribe, loading, error }: { atRisk: number; onSubscribe: () => void; loading: boolean; error: string }) {
  const t = useTranslations('dashboard');
  const TEASER_CLIENTS = t.teaser.samples.map((s, i) => ({ ...s, ...TEASER_META[i] }));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="pointer-events-none select-none overflow-hidden blur-[3px]" aria-hidden="true">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-semibold">{t.table.columnClient}</th>
              <th className="px-5 py-3 font-semibold">{t.table.columnRevenue}</th>
              <th className="px-5 py-3 font-semibold">{t.table.columnRisk}</th>
              <th className="px-5 py-3 font-semibold">{t.table.columnReason}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {TEASER_CLIENTS.map((c) => {
              const badge = riskBadge(c.score, t.riskBadge);
              return (
                <tr key={c.name}>
                  <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">{c.name}</td>
                  <td className="px-5 py-4 text-slate-700 dark:text-slate-300">{formatEuro(c.revenue)}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span></td>
                  <td className="max-w-[260px] px-5 py-4 text-slate-600 dark:text-slate-400">{c.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 p-8 text-center dark:bg-slate-900/80">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
          <Lock className="h-6 w-6 text-amber-500" />
        </div>
        <p className="text-base font-bold text-slate-900 dark:text-white">
          {atRisk > 0 ? t.teaser.detected(atRisk) : t.teaser.unlockDefault}
        </p>
        <p className="max-w-sm text-sm text-slate-600 dark:text-slate-400">
          {t.teaser.body}
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onSubscribe}
          disabled={loading}
          className="mt-1 flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60 dark:hover:bg-brand-500"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {t.teaser.redirecting}
            </>
          ) : (
            t.teaser.startTrial
          )}
        </motion.button>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}

function ChurnEducationSection({
  industry,
  churnRate,
  clientCount,
  atRisk,
  annualLoss,
  completedActions,
  hasAnalysis,
}: {
  industry: string | null;
  churnRate: number;
  clientCount: number;
  atRisk: number;
  annualLoss: number;
  completedActions: number;
  hasAnalysis: boolean;
}) {
  const t = useTranslations('dashboard');
  const te = t.education;
  const benchmarkRate = INDUSTRY_BENCHMARK_RATES[industry ?? ''] ?? INDUSTRY_BENCHMARK_RATES.other;
  const benchmarkLabel = t.industryBenchmarkLabels[industry ?? ''] ?? t.industryBenchmarkLabels.other;
  const [expanded, setExpanded] = useState<number | null>(null);

  // Signaux réels (pas de supposition) : au-dessus de la moyenne secteur + aucune
  // action de rétention engagée = l'entreprise ne s'occupe pas encore de son churn.
  const aboveBenchmark = churnRate > benchmarkRate;
  const passive = hasAnalysis && aboveBenchmark && completedActions === 0 && atRisk > 0;
  const alreadyActing = completedActions > 0;
  const annualRetentionRate = Math.min(100, Math.round((1 - Math.pow(1 - churnRate / 100, 12)) * 100));
  const churnRateStr = churnRate.toFixed(1);

  const churnDetail = !hasAnalysis
    ? te.churnDetailNoAnalysis
    : te.churnDetailWithAnalysis(churnRateStr, annualRetentionRate, clientCount, formatEuro(annualLoss));

  const actDetail = !hasAnalysis
    ? te.actDetailNoAnalysis
    : atRisk === 0
    ? te.actDetailNoRisk
    : alreadyActing
    ? te.actDetailAlreadyActing(completedActions, atRisk)
    : te.actDetailPassive(atRisk);

  const retentionDetail = !hasAnalysis
    ? te.retentionDetailNoAnalysis
    : passive
    ? te.retentionDetailPassive(churnRateStr, benchmarkRate, benchmarkLabel, formatEuro(annualLoss))
    : alreadyActing
    ? te.retentionDetailAlreadyActing(completedActions, formatEuro(clientCount ? annualLoss / Math.max(1, atRisk || 1) : 0))
    : te.retentionDetailOnTrack(churnRateStr, benchmarkRate, benchmarkLabel);

  const cardIcons = [Sparkles, Target, ShieldCheck];
  const cards = te.cards.map((card, i) => ({
    ...card,
    icon: cardIcons[i],
    detail: [churnDetail, actDetail, retentionDetail][i],
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }} className="relative z-10">
      <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">{te.title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card, i) => {
          const isOpen = expanded === i;
          return (
            <motion.button
              key={card.title}
              type="button"
              onClick={() => setExpanded(isOpen ? null : i)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: i * 0.1 }}
              className="rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:border-brand-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-800/60"
            >
              <div className="flex items-start justify-between gap-2">
                <card.icon className="mb-3 h-5 w-5 text-brand-600 dark:text-brand-400" />
                <ChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{card.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{card.body}</p>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE_OUT }}
                    className="overflow-hidden"
                  >
                    <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-400">{card.detail}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
      {churnRate > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.3 }}
          className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/50 p-5 text-sm dark:border-brand-800/40 dark:bg-brand-500/5"
        >
          <p className="text-slate-700 dark:text-slate-300">
            {te.benchmarkCompare(churnRateStr, benchmarkRate, benchmarkLabel)}{' '}
            {churnRate > benchmarkRate ? te.benchmarkWorse : te.benchmarkBetter}
          </p>
        </motion.div>
      )}
    </motion.div>
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
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);

  const [activating, setActivating] = useState(false);
  const [activationDelayed, setActivationDelayed] = useState(false);
  const t = useTranslations('dashboard');
  const { localeTag } = useLanguage();

  const fetchProfile = useCallback(async (userId: string) => {
    const { data: profileData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    return profileData as Profile | null;
  }, []);

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
      let profileData = await fetchProfile(data.user.id);
      setProfile(profileData);
      await loadData(data.user.id);
      setLoading(false);

      const params = new URLSearchParams(window.location.search);
      if (params.get('checkout') === 'success') {
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 5000);
        window.history.replaceState({}, '', '/dashboard');

        // Stripe redirige ici avant que le webhook n'ait forcément fini de
        // marquer l'abonnement actif côté base — sans ça l'utilisateur revient
        // sur un dashboard qui a l'air toujours verrouillé juste après avoir payé.
        const isUnlocked = (p: Profile | null) => p?.subscription_status === 'active' || p?.subscription_status === 'trialing';
        if (!isUnlocked(profileData)) {
          setActivating(true);
          for (let attempt = 0; attempt < 10 && !isUnlocked(profileData); attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            profileData = await fetchProfile(data.user.id);
            setProfile(profileData);
          }
          if (isUnlocked(profileData)) {
            await loadData(data.user.id);
          } else {
            setActivationDelayed(true);
          }
          setActivating(false);
        }
      }
    });
  }, [router, loadData, fetchProfile]);

  async function handleSubscribe() {
    setCheckoutLoading(true);
    setCheckoutError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // Le palier facturé est calculé côté serveur à partir du profil en
      // base (voir /api/create-checkout-session) — pas besoin de l'envoyer.
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });

      if (!response.ok) throw new Error(t.checkoutErrorStart);

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : t.checkoutErrorFallback);
      setCheckoutLoading(false);
    }
  }

  const status = profile?.subscription_status ?? 'inactive';
  const hasAccess = status === 'active' || status === 'trialing';

  const trialDaysLeft = useMemo(() => {
    if (status !== 'trialing' || !profile?.trial_end) return 0;
    const diff = new Date(profile.trial_end).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [status, profile]);

  const metrics = useMemo(() => {
    const clientCount = profile?.client_count ?? clients.length ?? 0;
    const mrr = profile?.monthly_revenue ?? clients.reduce((sum, c) => sum + (Number(c.revenue_monthly) || 0), 0);
    const churnRate = profile?.churn_rate ?? 0;
    // Une fois une vraie analyse disponible, le nombre de clients à risque
    // vient directement des résultats réels (churn_score >= 60), pas d'une
    // formule qui multiplie le taux réel par client_count — un chiffre
    // auto-déclaré à l'inscription qui peut ne plus correspondre du tout au
    // nombre de clients réellement importés/analysés. Avant toute analyse,
    // on garde l'estimation ; voir la note dans app/signup/page.tsx sur le
    // Math.max(1, ...) qui évite d'afficher "0 client à risque" trompeur.
    const atRisk = clients.length > 0
      ? clients.filter((c) => c.churn_score >= 60).length
      : (clientCount > 0 && churnRate > 0 ? Math.max(1, Math.round((clientCount * churnRate) / 100)) : 0);
    const ltv = clientCount ? mrr / clientCount : 0;
    const monthlyLoss = (mrr * churnRate) / 100;
    const annualLoss = monthlyLoss * 12;
    const potentialSavings = monthlyLoss * 0.5;
    return { mrr, churnRate, ltv, clientCount, atRisk, monthlyLoss, annualLoss, potentialSavings };
  }, [clients, profile]);

  const chartData = useMemo(() => {
    // Une soustraction linéaire (mrr - monthlyLoss * mois) part dans le
    // négatif dès que le churn réel est élevé (ex: 40%/mois sur 3 mois de
    // suite dépasse déjà le mrr de départ), ce qui casse visuellement les
    // barres. Même modèle à effet composé que le reste du dashboard
    // (ChurnEducationSection) : le revenu restant ne descend jamais sous 0.
    const retention = 1 - metrics.churnRate / 100;
    return Array.from({ length: 12 }, (_, i) => {
      const revenue = metrics.mrr * Math.pow(Math.max(0, retention), i + 1);
      return {
        month: t.months[i],
        revenue: Math.round(revenue),
        loss: Math.round(metrics.mrr - revenue),
      };
    });
  }, [metrics, t.months]);

  const riskDistribution = useMemo(() => {
    const buckets = [
      { range: t.riskBuckets[0], count: 0, color: '#10b981' },
      { range: t.riskBuckets[1], count: 0, color: '#fbbf24' },
      { range: t.riskBuckets[2], count: 0, color: '#f97316' },
      { range: t.riskBuckets[3], count: 0, color: '#ef4444' },
    ];
    for (const c of clients) {
      if (c.churn_score <= 25) buckets[0].count++;
      else if (c.churn_score <= 50) buckets[1].count++;
      else if (c.churn_score <= 75) buckets[2].count++;
      else buckets[3].count++;
    }
    return buckets;
  }, [clients, t.riskBuckets]);

  const history = useMemo(() => {
    const events: { date: string; text: string }[] = [];
    for (const action of actionLog) {
      if (!action.completed) continue;
      events.push({ date: action.created_at, text: t.historyEmailSent(action.client_name) });
    }
    for (const upload of uploads) {
      events.push({ date: upload.upload_date, text: t.historyDataAnalyzed(upload.client_count) });
    }
    if (user?.created_at) events.push({ date: user.created_at, text: t.historyAccountCreated });
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);
  }, [actionLog, uploads, user, t]);

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

  const planLabel =
    status === 'active' ? t.planLabel.active(String(profile?.subscription_tier))
    : status === 'trialing' ? t.planLabel.trialing(trialDaysLeft)
    : status === 'past_due' ? t.planLabel.pastDue
    : status === 'canceled' ? t.planLabel.canceled
    : t.planLabel.free;

  const estimatedLifetimeMonths = metrics.churnRate > 0 ? Math.round(100 / metrics.churnRate) : 0;

  const metricCards = [
    {
      label: t.metricCards.mrrLabel,
      value: formatEuro(metrics.mrr),
      icon: Euro,
      accent: 'text-slate-900 dark:text-white',
      detail: t.metricCards.mrrDetail(metrics.clientCount, formatEuro(metrics.ltv)),
    },
    {
      label: t.metricCards.churnLabel,
      value: `${metrics.churnRate.toFixed(1)}%`,
      icon: TrendingDown,
      accent: 'text-red-500 dark:text-red-400',
      detail: t.metricCards.churnDetail(metrics.churnRate.toFixed(1), Math.min(100, Math.round((1 - Math.pow(1 - metrics.churnRate / 100, 12)) * 100))),
    },
    {
      label: t.metricCards.ltvLabel,
      value: formatEuro(metrics.ltv),
      icon: Users,
      accent: 'text-slate-900 dark:text-white',
      detail: t.metricCards.ltvDetail(formatEuro(metrics.ltv), estimatedLifetimeMonths ? String(estimatedLifetimeMonths) : '—', formatEuro(metrics.ltv * (estimatedLifetimeMonths || 0))),
    },
    {
      label: t.metricCards.atRiskLabel,
      value: `${metrics.atRisk}`,
      icon: AlertTriangle,
      accent: 'text-amber-600 dark:text-amber-400',
      detail: t.metricCards.atRiskDetail(metrics.atRisk, metrics.clientCount, formatEuro(metrics.atRisk * metrics.ltv)),
    },
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
              <Check className="h-4 w-4" /> {t.toast.paymentSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }} className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{profile?.company_name || t.fallbackTitle}</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{planLabel}</p>
            </div>
          </div>
        </motion.div>

        {status === 'trialing' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="relative z-10 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 px-5 py-4 dark:border-brand-800/40 dark:bg-brand-500/5"
          >
            <Clock className="h-5 w-5 flex-shrink-0 text-brand-600 dark:text-brand-400" />
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {t.trialBanner(trialDaysLeft)}
            </p>
          </motion.div>
        )}

        {activating && (status === 'inactive' || status === 'canceled') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="relative z-10 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 px-5 py-4 dark:border-brand-800/40 dark:bg-brand-500/5"
          >
            <div className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 dark:border-brand-800 dark:border-t-brand-500" />
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {t.activatingBanner}
            </p>
          </motion.div>
        )}

        {!activating && activationDelayed && (status === 'inactive' || status === 'canceled') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="relative z-10 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-500/10 dark:text-amber-400"
          >
            {t.activationDelayedBanner}
          </motion.div>
        )}

        {!activating && !activationDelayed && (status === 'inactive' || status === 'canceled') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="relative z-10 flex flex-col items-start gap-3 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t.unlockBanner.textBase}
              {profile?.industry === 'manager' || profile?.trial_used
                ? '.'
                : <strong className="text-slate-900 dark:text-white">{t.unlockBanner.textTrialSuffix}</strong>}
            </p>
            <button
              onClick={handleSubscribe}
              disabled={checkoutLoading}
              className="flex flex-shrink-0 items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60 dark:hover:bg-brand-500"
            >
              {checkoutLoading ? t.unlockBanner.redirecting : profile?.industry === 'manager' || profile?.trial_used ? t.unlockBanner.subscribeButton : t.unlockBanner.trialButton}
            </button>
          </motion.div>
        )}

        {status === 'past_due' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="relative z-10 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-500/10 dark:text-amber-400"
          >
            {t.pastDueBanner}
          </motion.div>
        )}

        {checkoutError && (status === 'inactive' || status === 'canceled') && (
          <p className="relative z-10 -mt-4 text-sm text-red-600 dark:text-red-400">{checkoutError}</p>
        )}

        <div className="relative z-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {metricCards.map((card, i) => {
            const isOpen = expandedMetric === card.label;
            return (
              <motion.button
                key={card.label}
                type="button"
                onClick={() => setExpandedMetric(isOpen ? null : card.label)}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT, delay: i * 0.1 }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:border-brand-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-800/60"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{card.label}</p>
                  <div className="flex items-center gap-1.5">
                    <card.icon className={`h-4 w-4 ${card.accent}`} />
                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{card.value}</p>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-400">{card.detail}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }}
          className="relative z-10 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t.insights.title}</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {t.insights.body(formatEuro(metrics.monthlyLoss), formatEuro(metrics.annualLoss), formatEuro(metrics.potentialSavings))}
          </p>
        </motion.div>

        <div className="relative z-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: EASE_OUT }} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t.revenueProjectionTitle}</h2>
            </div>
            <div className="h-[220px]">
              <ResponsiveRevenueChart data={chartData} mrr={metrics.mrr} />
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.15 }} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t.riskDistributionTitle}</h2>
            </div>
            <div className="h-[220px]">
              <ResponsiveRiskChart data={riskDistribution} />
            </div>
          </motion.div>
        </div>

        <ChurnEducationSection
          industry={profile?.industry ?? null}
          churnRate={metrics.churnRate}
          clientCount={metrics.clientCount}
          atRisk={metrics.atRisk}
          annualLoss={metrics.annualLoss}
          completedActions={actionLog.filter((a) => a.completed).length}
          hasAnalysis={clients.length > 0}
        />

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }} className="relative z-10">
          <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">{t.atRiskClientsTitle}</h2>
          {hasAccess ? (
            <PaidClientTable clients={clients} onEmailSent={() => user && loadData(user.id)} />
          ) : (
            <LockedClientsTeaser atRisk={metrics.atRisk} onSubscribe={handleSubscribe} loading={checkoutLoading} error={checkoutError} />
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }} className="relative z-10">
          <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">{t.historyTitle}</h2>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {history.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">{t.historyEmpty}</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {history.map((event, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="w-24 shrink-0 text-slate-400 dark:text-slate-500">{new Date(event.date).toLocaleDateString(localeTag, { day: '2-digit', month: 'long' })}</span>
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

// Hauteurs en pixels fixes plutôt qu'en %: dans un flex container avec
// items-end, un enfant flex-col n'a pas de hauteur resolvable pour ses
// propres enfants en %, donc les barres restaient bloquees a 0px de haut.
const REVENUE_BAR_AREA_HEIGHT = 170;
const RISK_BAR_AREA_HEIGHT = 140;

function ResponsiveRevenueChart({ data, mrr }: { data: { month: string; revenue: number; loss: number }[]; mrr: number }) {
  // Normalise sur le mrr de départ (revenue + loss vaut toujours ~mrr avec
  // le modèle à effet composé) plutôt que sur le max de la série : un churn
  // extrême (proche de 100%) ne fait alors jamais déborder les barres.
  const total = Math.max(mrr, 1);
  return (
    <div className="flex h-full items-end gap-1">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-col items-center justify-end gap-0.5" style={{ height: REVENUE_BAR_AREA_HEIGHT }}>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.min(1, d.revenue / total) * REVENUE_BAR_AREA_HEIGHT}px` }}
              transition={{ duration: 0.8, ease: EASE_OUT, delay: i * 0.05 }}
              className="w-full rounded-t bg-brand-500/80"
            />
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.min(1, d.loss / total) * REVENUE_BAR_AREA_HEIGHT}px` }}
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
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-2" style={{ height: RISK_BAR_AREA_HEIGHT + 36 }}>
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(d.count > 0 ? 8 : 0, (d.count / max) * RISK_BAR_AREA_HEIGHT)}px` }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: i * 0.1 }}
            className="w-full rounded-t-lg"
            style={{ backgroundColor: d.color }}
          />
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{d.range}</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{d.count}</span>
        </div>
      ))}
    </div>
  );
}
