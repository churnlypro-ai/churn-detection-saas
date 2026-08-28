'use client';

import { useState } from 'react';
import { ChevronDown, Copy, Check } from 'lucide-react';

function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function riskBadge(score: number): { label: string; className: string } {
  if (score > 80) return { label: `${score}% 🔴`, className: 'bg-red-50 text-red-700' };
  if (score >= 60) return { label: `${score}% 🟠`, className: 'bg-orange-50 text-orange-700' };
  if (score >= 40) return { label: `${score}% 🟡`, className: 'bg-yellow-50 text-yellow-700' };
  return { label: `${score}% 🟢`, className: 'bg-emerald-50 text-emerald-700' };
}

const ACTIONS = [
  { type: 'email', label: 'Envoyer email de réengagement' },
  { type: 'call', label: 'Demander un appel' },
  { type: 'offer', label: 'Offre spéciale' },
] as const;

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
  // Optionnel — seul /demo le fournit. Quand présent, l'action "Envoyer
  // email" devient cliquable et déplie l'email réellement généré pour ce
  // client, pour montrer concrètement que la "solution" n'est pas qu'une
  // phrase mais du contenu prêt à envoyer. Sans ce prop (dashboard/admin
  // réels), le comportement reste identique à avant : une simple case à
  // cocher qui alimente le suivi d'actions en base.
  emailDrafts?: Record<string, string>;
}

export default function ClientTable({ clients, actionState, onToggleAction, emailDrafts }: ClientTableProps) {
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [copiedClient, setCopiedClient] = useState<string | null>(null);

  if (!clients || clients.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-500">
        Aucun client analysé pour l&apos;instant.
      </div>
    );
  }

  async function handleCopy(clientName: string, draft: string) {
    try {
      await navigator.clipboard.writeText(draft);
      setCopiedClient(clientName);
      setTimeout(() => setCopiedClient((c) => (c === clientName ? null : c)), 2000);
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
            const draft = emailDrafts?.[client.client_name];
            const isExpanded = expandedClient === client.client_name;
            return (
              <tr key={client.id ?? client.client_name} className="align-top hover:bg-slate-50/50">
                <td className="px-5 py-4 font-medium text-slate-900">{client.client_name}</td>
                <td className="px-5 py-4 text-slate-700">{formatEuro(client.revenue_monthly)}</td>
                <td className="px-5 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
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

                      if (action.type === 'email' && draft) {
                        return (
                          <button
                            key={action.type}
                            type="button"
                            onClick={() => setExpandedClient(isExpanded ? null : client.client_name)}
                            className="flex items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-left text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-800/60 dark:bg-brand-500/10 dark:text-brand-400"
                          >
                            Voir l&apos;email prêt à envoyer
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
                  {draft && isExpanded && (
                    <div className="mt-3 w-full max-w-sm rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/60">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Généré par Churnly, prêt à envoyer
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(client.client_name, draft)}
                          className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                        >
                          {copiedClient === client.client_name ? (
                            <><Check className="h-3 w-3" /> Copié</>
                          ) : (
                            <><Copy className="h-3 w-3" /> Copier</>
                          )}
                        </button>
                      </div>
                      <p className="whitespace-pre-line text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                        {draft}
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
