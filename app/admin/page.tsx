'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, Euro, AlertTriangle, TrendingUp, XCircle, Clock, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';
import { formatEuro } from '@/lib/pricing';

interface RiskInfo {
  score: number;
  level: 'low' | 'medium' | 'high';
  reason: string;
}

interface AccountRow {
  id: string;
  email: string;
  companyName: string | null;
  subscriptionStatus: string;
  monthlyPrice: number;
  createdAt: string;
  becamePayingAt: string | null;
  trialEnd: string | null;
  lastActivityAt: string | null;
  risk: RiskInfo;
}

interface Summary {
  totalAccounts: number;
  activePaying: number;
  trialing: number;
  pastDue: number;
  canceled: number;
  mrr: number;
  highRiskCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Payant',
  trialing: 'Essai',
  past_due: 'Paiement en échec',
  canceled: 'Annulé',
  inactive: 'Inactif',
};

const RISK_STYLES: Record<RiskInfo['level'], string> = {
  low: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  high: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

function relativeDate(iso: string | null): string {
  if (!iso) return 'Jamais';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Aujourd\'hui';
  if (days === 1) return 'Hier';
  return `Il y a ${days} jours`;
}

export default function AdminOverview() {
  const router = useRouter();
  const [user, setUser] = useState<{ id?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) { router.replace('/login'); return; }
      setUser(data.user);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${token}` } });

      if (res.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setLoading(false);
        return;
      }

      const result = await res.json();
      setSummary(result.summary);
      setAccounts(result.accounts ?? []);
      setLoading(false);
    });
  }, [router]);

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

  const cards = summary ? [
    { label: 'Comptes total', value: summary.totalAccounts, icon: Users },
    { label: 'MRR', value: formatEuro(summary.mrr), icon: Euro },
    { label: 'Payants actifs', value: summary.activePaying, icon: TrendingUp },
    { label: 'En essai', value: summary.trialing, icon: Clock },
    { label: 'Paiement en échec', value: summary.pastDue, icon: AlertTriangle },
    { label: 'Risque élevé', value: summary.highRiskCount, icon: AlertTriangle },
  ] : [];

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="mb-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          Vue d&apos;ensemble Churnly
        </motion.h1>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Tous les comptes Churnly, leur statut, et leur risque de résiliation — calculé à partir de leur activité réelle sur le produit.
        </p>
        <Link
          href="/admin/prospecting"
          className="mb-10 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Prospection par email →
        </Link>

        {loading ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {cards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <card.icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{card.value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
                    <th className="px-4 py-3 font-medium">Entreprise</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 font-medium">Prix</th>
                    <th className="px-4 py-3 font-medium">Dernière activité</th>
                    <th className="px-4 py-3 font-medium">Risque</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">{account.companyName || '—'}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{account.email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {STATUS_LABELS[account.subscriptionStatus] ?? account.subscriptionStatus}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {account.monthlyPrice > 0 ? formatEuro(account.monthlyPrice) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{relativeDate(account.lastActivityAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${RISK_STYLES[account.risk.level]}`}>
                          {account.risk.score}
                        </span>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{account.risk.reason}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/accounts/${account.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                        >
                          Voir <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  );
}
