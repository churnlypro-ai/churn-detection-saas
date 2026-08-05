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
}

export default function ClientTable({ clients, actionState, onToggleAction }: ClientTableProps) {
  if (!clients || clients.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-500">
        Aucun client analysé pour l&apos;instant.
      </div>
    );
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
                <td className="px-5 py-4">
                  <div className="flex flex-col gap-1.5">
                    {ACTIONS.map((action) => {
                      const key = `${client.client_name}-${action.type}`;
                      const checked = Boolean(actionState?.[key]);
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
