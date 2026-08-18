'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import MetricCards from '@/components/MetricCards';
import ClientTable from '@/components/ClientTable';
import { EASE_OUT } from '@/lib/animations';

interface AccountData {
  profile: {
    email: string;
    company_name: string | null;
    subscription_status: string;
    subscription_tier: string | null;
    industry: string | null;
    business_description: string | null;
  };
  clients: { client_name: string; revenue_monthly: number; churn_score: number; reason: string; solution: string }[];
  metrics: { mrr: number; churnRate: number; ltv: number; clientCount: number; atRisk: number };
}

export default function AdminAccountView() {
  const router = useRouter();
  const params = useParams();
  const accountId = params?.id as string;
  const [user, setUser] = useState<{ id?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [data, setData] = useState<AccountData | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: authData }) => {
      if (!authData?.user) { router.replace('/login'); return; }
      setUser(authData.user);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`/api/admin/account/${accountId}`, { headers: { Authorization: `Bearer ${token}` } });

      if (res.status === 403 || res.status === 404) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setLoading(false);
        return;
      }

      setData(await res.json());
      setLoading(false);
    });
  }, [router, accountId]);

  if (forbidden) {
    return (
      <>
        <Navigation user={user} />
        <main className="mx-auto max-w-2xl px-6 py-24 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Accès refusé ou compte introuvable</p>
          <Link href="/admin" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
            <ArrowLeft className="h-4 w-4" /> Retour à la vue d&apos;ensemble
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <Link href="/admin" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400">
          <ArrowLeft className="h-4 w-4" /> Retour à la vue d&apos;ensemble
        </Link>

        {loading || !data ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
              className="mb-2"
            >
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {data.profile.company_name || 'Sans nom'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{data.profile.email}</p>
            </motion.div>
            <p className="mb-8 text-xs text-slate-400 dark:text-slate-500">
              Vue en lecture seule — exactement ce que ce compte voit sur son propre dashboard.
            </p>

            <MetricCards
              mrr={data.metrics.mrr}
              churnRate={data.metrics.churnRate}
              ltv={data.metrics.ltv}
              atRisk={data.metrics.atRisk}
            />

            <div className="mt-8">
              <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Clients à risque</h2>
              <ClientTable clients={data.clients} actionState={{}} onToggleAction={() => {}} />
            </div>
          </>
        )}
      </main>
    </>
  );
}
