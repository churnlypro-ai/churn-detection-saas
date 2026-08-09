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
import { calcPrice, formatEuro as formatEuroShared } from '@/lib/pricing';

interface Profile {
  company_name: string;
  subscription_tier: string | null;
  subscription_status: string;
  client_count: number | null;
  monthly_revenue: number | null;
  industry: string | null;
  churn_rate: number | null;
  trial_end: string | null;
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

function riskBadge(score: number): { label: string; className: string } {
  if (score > 80) return { label: `${score}% Critique`, className: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' };
  if (score >= 60) return { label: `${score}% Risque`, className: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' };
  if (score >= 40) return { label: `${score}% Surveiller`, className: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400' };
  return { label: `${score}% Stable`, className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' };
}

const INDUSTRY_BENCHMARKS: Record<string, { label: string; rate: number }> = {
  saas: { label: 'SaaS', rate: 5 },
  agency: { label: 'agences', rate: 8 },
  ecommerce: { label: 'e-commerce', rate: 10 },
  other: { label: 'votre secteur', rate: 7 },
};

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

const WEIGHT_STYLES: Record<RiskFactor['weight'], string> = {
  high: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

function ClientDetailRow({ client }: { client: AnalysisRow }) {
  const factors = client.details?.risk_factors ?? [];
  const actions = client.details?.recommended_actions ?? [];

  return (
    <tr className="bg-slate-50/60 dark:bg-slate-800/30">
      <td colSpan={6} className="px-5 py-5">
        {typeof client.confidence === 'number' && (
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Confiance de l'analyse : <strong>{Math.round(client.confidence * 100)}%</strong>
            {client.confidence < 0.6 && ' — données limitées pour ce client, à prendre avec prudence.'}
          </p>
        )}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Facteurs de risque</p>
            {factors.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">Aucun détail disponible.</p>
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
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Actions recommandées</p>
            {actions.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">Aucune action détaillée disponible.</p>
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

  if (!clients.length) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Aucun client analysé pour l'instant. Importez un CSV pour voir vos clients à risque ici.
      </div>
    );
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
                            <Info className="h-3.5 w-3.5" /> Info client
                          </button>
                        )}
                        <button
                          onClick={() => setEmailClient(client)}
                          className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"
                        >
                          <Mail className="h-3.5 w-3.5" /> Envoyer un email
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

const TEASER_CLIENTS = [
  { name: 'A••••• M•••••', revenue: 1200, score: 82, reason: 'Aucune connexion depuis 21 jours, 3 tickets support non résolus.' },
  { name: 'B••• & C••', revenue: 2400, score: 67, reason: 'Usage en baisse de 40% ce mois-ci par rapport à la moyenne.' },
  { name: 'D•••••• S••', revenue: 890, score: 58, reason: 'Facture en retard de paiement, aucune réponse aux relances.' },
];

function LockedClientsTeaser({ atRisk, onSubscribe, loading, error }: { atRisk: number; onSubscribe: () => void; loading: boolean; error: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="pointer-events-none select-none overflow-hidden blur-[3px]" aria-hidden="true">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-semibold">Client</th>
              <th className="px-5 py-3 font-semibold">Revenue</th>
              <th className="px-5 py-3 font-semibold">Risque</th>
              <th className="px-5 py-3 font-semibold">Raison</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {TEASER_CLIENTS.map((c) => {
              const badge = riskBadge(c.score);
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
          {atRisk > 0 ? `${atRisk} client${atRisk > 1 ? 's' : ''} à risque détecté${atRisk > 1 ? 's' : ''} chez vous` : 'Débloquez la liste détaillée de vos clients'}
        </p>
        <p className="max-w-sm text-sm text-slate-600 dark:text-slate-400">
          Noms, scores de risque, raisons précises et emails prêts à envoyer — inclus dans l'essai gratuit de 3 jours, sans engagement.
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
              Redirection…
            </>
          ) : (
            'Démarrer mon essai gratuit'
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
  const benchmark = INDUSTRY_BENCHMARKS[industry ?? ''] ?? INDUSTRY_BENCHMARKS.other;
  const [expanded, setExpanded] = useState<number | null>(null);

  // Signaux réels (pas de supposition) : au-dessus de la moyenne secteur + aucune
  // action de rétention engagée = l'entreprise ne s'occupe pas encore de son churn.
  const aboveBenchmark = churnRate > benchmark.rate;
  const passive = hasAnalysis && aboveBenchmark && completedActions === 0 && atRisk > 0;
  const alreadyActing = completedActions > 0;
  const annualRetentionRate = Math.min(100, Math.round((1 - Math.pow(1 - churnRate / 100, 12)) * 100));

  const churnDetail = !hasAnalysis
    ? 'Le churn se mesure généralement sur une base mensuelle : (clients perdus ce mois-ci / clients au début du mois) × 100. Ce qui le rend trompeur, c\'est l\'effet composé — un churn constant de 5%/mois donne un taux de rétention annuel d\'environ 54%, pas 95% comme on pourrait le croire intuitivement. Importez vos données pour voir votre propre chiffre.'
    : `Chez vous, un churn de ${churnRate.toFixed(1)}%/mois représente, avec l'effet composé sur 12 mois, environ ${annualRetentionRate}% de votre base ${clientCount} clients qui pourrait se renouveler d'ici un an — soit ${formatEuro(annualLoss)} de revenu menacé sur l'année si rien ne change. C'est ce calcul, précisément, que fait Churnly à chaque upload.`;

  const actDetail = !hasAnalysis
    ? 'Les signaux précoces les plus fiables : une baisse de fréquence de connexion sur 2 semaines consécutives, un ticket support resté sans réponse plus de 48h, ou un retard de paiement — même s\'il est régularisé ensuite. Importez un CSV pour que Churnly détecte ces signaux sur vos propres clients.'
    : atRisk === 0
    ? 'Aucun client n\'est actuellement identifié comme à risque chez vous — c\'est le bon moment pour garder ce rythme et ré-analyser régulièrement, avant qu\'un signal faible n\'apparaisse.'
    : alreadyActing
    ? `Vous avez déjà engagé ${completedActions} action${completedActions > 1 ? 's' : ''} de rétention — c'est le bon réflexe. Il vous reste ${atRisk} client${atRisk > 1 ? 's' : ''} identifié${atRisk > 1 ? 's' : ''} à risque : plus vous agissez tôt sur ceux-là, plus la chance de les retenir est haute.`
    : `Vous avez ${atRisk} client${atRisk > 1 ? 's' : ''} à risque identifié${atRisk > 1 ? 's' : ''} chez vous et aucune action de rétention envoyée pour l'instant. C'est exactement la fenêtre de 30 à 60 jours où agir change encore la donne — au-delà, le client a généralement déjà pris sa décision.`;

  const retentionDetail = !hasAnalysis
    ? 'Acquérir un nouveau client coûte en moyenne 5 à 7x plus cher que d\'en retenir un existant, et il faut souvent plusieurs mois avant que ce nouveau client devienne rentable. Importez vos données pour voir ce que ça représente concrètement pour vous.'
    : passive
    ? `Votre churn est de ${churnRate.toFixed(1)}%/mois, au-dessus de la moyenne de ${benchmark.rate}%/mois pour les ${benchmark.label} — et aucune action de rétention n'a encore été engagée. Ça veut dire que ${formatEuro(annualLoss)}/an partent aujourd'hui sans qu'aucune tentative de les retenir ne soit faite. C'est la plus grosse marge de progression disponible chez vous, avant même de penser acquisition.`
    : alreadyActing
    ? `Vous avez déjà ${completedActions} action${completedActions > 1 ? 's' : ''} de rétention engagée${completedActions > 1 ? 's' : ''} — c'est exactement ce levier qui génère jusqu'à 10x plus de valeur que l'acquisition. Chaque client retenu en plus, chez vous, représente en moyenne ${formatEuro(clientCount ? annualLoss / Math.max(1, atRisk || 1) : 0)}/an de revenu préservé.`
    : `Votre churn de ${churnRate.toFixed(1)}%/mois est déjà à ou sous la moyenne de ${benchmark.rate}%/mois pour les ${benchmark.label} — vous êtes déjà globalement dans la bonne direction. Continuez à surveiller : chaque point de churn gagné en plus représente une part quasi entièrement en marge, contrairement à un nouveau client acquis.`;

  const cards = [
    {
      icon: Sparkles,
      title: 'Qu\'est-ce que le churn ?',
      body: 'Le pourcentage de clients qui arrêtent d\'utiliser votre produit chaque mois. Un churn de 5% semble faible — mais sur un an, c\'est près de 50% de votre base qui disparaît.',
      detail: churnDetail,
    },
    {
      icon: Target,
      title: 'Agir avant l\'annulation',
      body: 'La plupart des dirigeants découvrent le problème quand le client a déjà parti. Les signaux faibles (inactivité, tickets support, retard de paiement) apparaissent 30 à 60 jours avant.',
      detail: actDetail,
    },
    {
      icon: ShieldCheck,
      title: 'Rétention > Acquisition',
      body: 'Un client retenu continue de payer, recommande votre produit, et coûte zéro en acquisition. La rétention génère jusqu\'à 10x plus de valeur que l\'acquisition de nouveaux clients.',
      detail: retentionDetail,
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }} className="relative z-10">
      <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Comprendre le churn</h2>
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
            Votre churn est de <strong className="text-brand-700 dark:text-brand-400">{churnRate.toFixed(1)}%/mois</strong>, contre une moyenne
            d'environ <strong>{benchmark.rate}%/mois</strong> pour les {benchmark.label}.{' '}
            {churnRate > benchmark.rate
              ? "Vous perdez des clients plus vite que la moyenne de votre secteur — c'est le moment d'agir."
              : "Vous êtes déjà en dessous de la moyenne de votre secteur — continuez à surveiller vos signaux faibles."}
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
    const atRisk = Math.round((clientCount * churnRate) / 100);
    const ltv = clientCount ? mrr / clientCount : 0;
    const monthlyLoss = (mrr * churnRate) / 100;
    const annualLoss = monthlyLoss * 12;
    const potentialSavings = monthlyLoss * 0.5;
    return { mrr, churnRate, ltv, clientCount, atRisk, monthlyLoss, annualLoss, potentialSavings };
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

  const planLabel =
    status === 'active' ? `Plan €${profile?.subscription_tier}/mois · Actif`
    : status === 'trialing' ? `Essai gratuit · ${trialDaysLeft}j restant${trialDaysLeft > 1 ? 's' : ''}`
    : status === 'past_due' ? 'Paiement en attente'
    : status === 'canceled' ? 'Abonnement annulé'
    : 'Version gratuite';

  const benchmark = INDUSTRY_BENCHMARKS[profile?.industry ?? ''] ?? INDUSTRY_BENCHMARKS.other;
  const estimatedLifetimeMonths = metrics.churnRate > 0 ? Math.round(100 / metrics.churnRate) : 0;

  const metricCards = [
    {
      label: 'MRR Total',
      value: formatEuro(metrics.mrr),
      icon: Euro,
      accent: 'text-slate-900 dark:text-white',
      detail: `Revenu mensuel récurrent total sur vos ${metrics.clientCount} clients, soit ${formatEuro(metrics.ltv)} par client en moyenne. C'est la base à partir de laquelle tout le reste (perte projetée, économies possibles) est calculé.`,
    },
    {
      label: 'Churn Rate',
      value: `${metrics.churnRate.toFixed(1)}%`,
      icon: TrendingDown,
      accent: 'text-red-500 dark:text-red-400',
      detail: `${metrics.churnRate.toFixed(1)}% de vos clients partent chaque mois, contre une moyenne d'environ ${benchmark.rate}%/mois pour les ${benchmark.label}. ${metrics.churnRate > benchmark.rate ? "Vous êtes au-dessus de la moyenne de votre secteur." : 'Vous êtes en dessous de la moyenne de votre secteur.'} Sur un an, ce rythme représente environ ${Math.min(100, Math.round((1 - Math.pow(1 - metrics.churnRate / 100, 12)) * 100))}% de votre base qui renouvelle.`,
    },
    {
      label: 'LTV Moyen',
      value: formatEuro(metrics.ltv),
      icon: Users,
      accent: 'text-slate-900 dark:text-white',
      detail: `Chaque client vous rapporte en moyenne ${formatEuro(metrics.ltv)}/mois. Avec votre churn actuel, sa durée de vie moyenne est estimée à environ ${estimatedLifetimeMonths || '—'} mois, pour une valeur totale d'environ ${formatEuro(metrics.ltv * (estimatedLifetimeMonths || 0))} sur toute la relation client.`,
    },
    {
      label: 'Clients à risque',
      value: `${metrics.atRisk}`,
      icon: AlertTriangle,
      accent: 'text-amber-600 dark:text-amber-400',
      detail: `${metrics.atRisk} client${metrics.atRisk > 1 ? 's' : ''} sur ${metrics.clientCount} ${metrics.atRisk > 1 ? 'sont' : 'est'} projeté${metrics.atRisk > 1 ? 's' : ''} au churn ce mois-ci, représentant environ ${formatEuro(metrics.atRisk * metrics.ltv)} de revenu menacé. Importez un CSV pour voir précisément lesquels et pourquoi.`,
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
              <Check className="h-4 w-4" /> Paiement réussi — bienvenue sur Churnly Premium
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }} className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{profile?.company_name || 'Dashboard'}</h1>
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
              <strong className="text-brand-700 dark:text-brand-400">{trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''} restant{trialDaysLeft > 1 ? 's' : ''}</strong> sur votre essai gratuit — toutes les fonctionnalités Premium sont débloquées, sans engagement.
            </p>
          </motion.div>
        )}

        {(status === 'inactive' || status === 'canceled') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="relative z-10 flex flex-col items-start gap-3 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Débloquez la liste complète de vos clients à risque, les emails générés par IA et bien plus —
              <strong className="text-slate-900 dark:text-white"> 3 jours d'essai gratuit, sans engagement.</strong>
            </p>
            <button
              onClick={handleSubscribe}
              disabled={checkoutLoading}
              className="flex flex-shrink-0 items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60 dark:hover:bg-brand-500"
            >
              {checkoutLoading ? 'Redirection…' : 'Démarrer mon essai gratuit'}
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
            Un problème est survenu avec votre dernier paiement. Merci de vérifier votre méthode de paiement sur Stripe pour ne pas perdre l'accès à Churnly Premium.
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
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Vos insights</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            À votre rythme actuel, vous perdez environ <strong className="text-red-600 dark:text-red-400">{formatEuro(metrics.monthlyLoss)}/mois</strong> à
            cause du churn, soit <strong className="text-red-600 dark:text-red-400">{formatEuro(metrics.annualLoss)}/an</strong>. En réduisant votre churn de
            moitié grâce aux actions ciblées de Churnly, vous pourriez récupérer jusqu'à{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">{formatEuro(metrics.potentialSavings)}/mois</strong>.
          </p>
        </motion.div>

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
          <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Clients à risque</h2>
          {hasAccess ? (
            <PaidClientTable clients={clients} onEmailSent={() => user && loadData(user.id)} />
          ) : (
            <LockedClientsTeaser atRisk={metrics.atRisk} onSubscribe={handleSubscribe} loading={checkoutLoading} error={checkoutError} />
          )}
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
