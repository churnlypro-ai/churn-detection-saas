'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Copy, Check } from 'lucide-react';

function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function riskBadge(score: number): { label: string; className: string; dotClassName: string } {
  if (score > 80) return { label: `${score}%`, className: 'bg-red-50 text-red-700', dotClassName: 'bg-red-500' };
  if (score >= 60) return { label: `${score}%`, className: 'bg-orange-50 text-orange-700', dotClassName: 'bg-orange-500' };
  if (score >= 40) return { label: `${score}%`, className: 'bg-yellow-50 text-yellow-700', dotClassName: 'bg-yellow-500' };
  return { label: `${score}%`, className: 'bg-emerald-50 text-emerald-700', dotClassName: 'bg-emerald-500' };
}

const ACTIONS = [
  { type: 'email', label: 'Envoyer email de réengagement' },
  { type: 'call', label: 'Demander un appel' },
  { type: 'offer', label: 'Offre spéciale' },
] as const;

type ActionType = (typeof ACTIONS)[number]['type'];

// Textes propres à chaque type d'action quand un contenu personnalisé est
// disponible (voir ClientTableProps.actionPreviews) — seul /demo fournit ce
// contenu, pour montrer concrètement ce que Churnly génère pour chaque
// client plutôt qu'une simple case à cocher.
const ACTION_PREVIEW_CONFIG: Record<ActionType, { buttonLabel: string; panelLabel: string; upsellText: string }> = {
  email: {
    buttonLabel: 'Voir l\'email prêt à envoyer',
    panelLabel: 'Généré par Churnly, prêt à envoyer',
    upsellText: 'Avec l\'abonnement, cet email est envoyé automatiquement.',
  },
  call: {
    buttonLabel: 'Voir le script d\'appel',
    panelLabel: 'Généré par Churnly — script d\'appel suggéré',
    upsellText: 'Avec l\'abonnement, la demande d\'appel est planifiée automatiquement dans votre calendrier.',
  },
  offer: {
    buttonLabel: 'Voir l\'offre recommandée',
    panelLabel: 'Généré par Churnly — offre recommandée',
    upsellText: 'Avec l\'abonnement, cette offre est appliquée automatiquement à ce client.',
  },
};

interface ClientRow {
  id?: string;
  client_name: string;
  revenue_monthly: number;
  churn_score: number;
  reason: string;
  solution: string;
}

interface ClientTableProps {
  clients: ClientRow[];
  actionState: Record<string, boolean>;
  onToggleAction: (clientName: string, actionType: string) => void;
  // Optionnel — seul /demo le fournit. Quand un contenu est présent pour une
  // action donnée, celle-ci devient cliquable et déplie ce que Churnly a
  // réellement généré pour ce client (email, script d'appel, offre), pour
  // montrer concrètement que la "solution" n'est pas qu'une phrase. Sans ce
  // prop (dashboard/admin réels), le comportement reste identique à avant :
  // une simple case à cocher qui alimente le suivi d'actions en base.
  actionPreviews?: Record<string, Partial<Record<ActionType, string>>>;
}

export default function ClientTable({ clients, actionState, onToggleAction, actionPreviews }: ClientTableProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!clients || clients.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-500">
        Aucun client analysé pour l&apos;instant.
      </div>
    );
  }

  async function handleCopy(previewKey: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedKey(previewKey);
      setTimeout(() => setCopiedKey((k) => (k === previewKey ? null : k)), 2000);
    } catch {
      // Presse-papiers indisponible (permissions navigateur) — pas grave,
      // l'utilisateur peut toujours sélectionner le texte à la main.
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
      <table className="w-full min-w-[840px] text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3 font-semibold">Client</th>
            <th className="px-5 py-3 font-semibold">Revenue</th>
            <th className="px-5 py-3 font-semibold">Risque</th>
            <th className="px-5 py-3 font-semibold">Raison</th>
            <th className="px-5 py-3 font-semibold">Solution</th>
            <th className="px-5 py-3 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {clients.map((client) => {
            const badge = riskBadge(client.churn_score);
            const previews = actionPreviews?.[client.client_name];
            const expandedType = expandedKey?.startsWith(`${client.client_name}:`)
              ? (expandedKey.slice(client.client_name.length + 1) as ActionType)
              : null;
            const expandedContent = expandedType ? previews?.[expandedType] : undefined;

            return (
              <tr key={client.id ?? client.client_name} className="align-top hover:bg-slate-50/50">
                <td className="px-5 py-4 font-medium text-slate-900">{client.client_name}</td>
                <td className="px-5 py-4 text-slate-700">{formatEuro(client.revenue_monthly)}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
                    <span className={`h-2 w-2 rounded-sm ${badge.dotClassName}`} />
                    {badge.label}
                  </span>
                </td>
                <td className="max-w-[220px] px-5 py-4 text-slate-600">{client.reason}</td>
                <td className="max-w-[240px] px-5 py-4 text-slate-600">{client.solution}</td>
                <td className="min-w-[260px] px-5 py-4">
                  <div className="flex flex-col gap-2">
                    {ACTIONS.map((action) => {
                      const key = `${client.client_name}-${action.type}`;
                      const checked = Boolean(actionState?.[key]);
                      const content = previews?.[action.type];

                      if (content) {
                        const previewKey = `${client.client_name}:${action.type}`;
                        const isExpanded = expandedKey === previewKey;
                        return (
                          <button
                            key={action.type}
                            type="button"
                            onClick={() => setExpandedKey(isExpanded ? null : previewKey)}
                            className="flex items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-left text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-800/60 dark:bg-brand-500/10 dark:text-brand-400"
                          >
                            {ACTION_PREVIEW_CONFIG[action.type].buttonLabel}
                            <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        );
                      }

                      return (
                        <label key={action.type} className="flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleAction?.(client.client_name, action.type)}
                            className="h-3.5 w-3.5 rounded accent-brand-600"
                          />
                          {action.label}
                        </label>
                      );
                    })}
                  </div>
                  {expandedType && expandedContent && (
                    <div className="mt-3 w-full max-w-sm rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/60">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {ACTION_PREVIEW_CONFIG[expandedType].panelLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`${client.client_name}:${expandedType}`, expandedContent)}
                          className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                        >
                          {copiedKey === `${client.client_name}:${expandedType}` ? (
                            <><Check className="h-3 w-3" /> Copié</>
                          ) : (
                            <><Copy className="h-3 w-3" /> Copier</>
                          )}
                        </button>
                      </div>
                      <p className="whitespace-pre-line text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                        {expandedContent}
                      </p>
                      <p className="mt-3 border-t border-slate-200 pt-2.5 text-[11px] leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        {ACTION_PREVIEW_CONFIG[expandedType].upsellText}{' '}
                        <Link
                          href="/pricing"
                          className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
                        >
                          Découvrir l&apos;abonnement →
                        </Link>
                      </p>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
