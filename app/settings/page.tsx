'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import MagicHexagon from '@/components/MagicHexagon';
import { EASE_OUT } from '@/lib/animations';
import { Building2, Users, Euro, TrendingDown, Lock, Check, AlertCircle } from 'lucide-react';
import type { HexagonStatus } from '@/components/MagicHexagon';

interface Profile {
  company_name: string;
  subscription_tier: string | null;
  subscription_status: string;
  client_count: number | null;
  monthly_revenue: number | null;
  industry: string | null;
  churn_rate: number | null;
  stripe_connected: boolean;
  intercom_connected: boolean;
}

import { calcPrice, formatEuro, priceBreakdown, tierName } from '@/lib/pricing';

function EditField({
  label, value, onChange, suffix, min, max, step, icon: Icon,
}: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string;
  min: number; max: number; step: number; icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [error, setError] = useState('');
  const [hexStatus, setHexStatus] = useState<HexagonStatus>('idle');

  const [editClients, setEditClients] = useState(100);
  const [editRevenue, setEditRevenue] = useState(50000);
  const [editChurn, setEditChurn] = useState(5);
  const [editCompany, setEditCompany] = useState('');
  const [editIndustry, setEditIndustry] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');

  const isLocked = profile?.subscription_status !== 'active';

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) { router.replace('/login'); return; }
      setUser(data.user);
      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      const p = profileData as Profile;
      setProfile(p);
      setEditClients(p?.client_count ?? 100);
      setEditRevenue(p?.monthly_revenue ?? 50000);
      setEditChurn(p?.churn_rate ?? 5);
      setEditCompany(p?.company_name ?? '');
      setEditIndustry(p?.industry ?? '');
      setLoading(false);
    });
  }, [router]);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    setError('');
    setHexStatus('loading');
    const { error: updateError } = await supabase
      .from('users')
      .update({
        company_name: editCompany,
        client_count: editClients,
        monthly_revenue: editRevenue,
        churn_rate: editChurn,
        industry: editIndustry,
      })
      .eq('id', user.id);

    setSaving(false);
    if (updateError) {
      setError('Erreur lors de la mise à jour.');
      setHexStatus('error');
      setTimeout(() => setHexStatus('idle'), 3000);
    } else {
      setSavedToast(true);
      setHexStatus('success');
      setTimeout(() => setSavedToast(false), 3000);
      setTimeout(() => setHexStatus('idle'), 2500);
    }
  }, [user, editCompany, editClients, editRevenue, editChurn, editIndustry]);

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordStatus('');
    const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordStatus(pwError ? 'Erreur lors du changement de mot de passe.' : 'Mot de passe mis à jour.');
    if (!pwError) setNewPassword('');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading || !user) {
    return (
      <>
        <Navigation user={user} />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="relative h-[400px] w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white shadow-sm">
            <MagicHexagon clientCount={100} churnRate={5} monthlyRevenue={50000} status="loading" />
          </div>
        </div>
      </>
    );
  }

  const currentPrice = calcPrice(editClients, editRevenue, editChurn);
  const breakdown = priceBreakdown(editClients, editRevenue, editChurn);

  const staticInfo = [
    { label: 'Entreprise', value: profile?.company_name || '—', icon: Building2 },
    { label: 'Clients', value: (profile?.client_count ?? 0).toString(), icon: Users },
    { label: 'Revenue mensuel', value: formatEuro(profile?.monthly_revenue ?? 0), icon: Euro },
    { label: 'Industry', value: profile?.industry || '—', icon: Building2 },
    { label: 'Taux de churn', value: `${(profile?.churn_rate ?? 0).toFixed(1)}%`, icon: TrendingDown },
  ];

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="mb-10 text-2xl font-bold tracking-tight text-slate-900"
        >
          Paramètres
        </motion.h1>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="space-y-4"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Profil actuel</h2>
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              {staticInfo.map((item) => (
                <div key={item.label} className="flex items-center justify-between border-b border-slate-50 py-3 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <item.icon className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-brand-700">Votre prix</h3>
              <motion.p
                key={currentPrice}
                initial={{ opacity: 0.5, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-2 text-4xl font-extrabold text-brand-700"
              >
                {formatEuro(currentPrice)}<span className="text-base font-medium text-slate-400">/mois</span>
              </motion.p>
              <div className="mt-4 space-y-1.5">
                {breakdown.map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-xs text-slate-600">
                    <span>{item.label}</span>
                    <span className="font-medium">+{formatEuro(item.amount)}</span>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between border-t border-brand-100 pt-2 text-sm font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{formatEuro(currentPrice)}</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400">Modifiez vos chiffres à droite pour voir le prix changer en direct.</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
            className="relative flex flex-col items-center justify-center"
          >
            <div className="relative h-[400px] w-full overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white shadow-sm">
              <MagicHexagon
                clientCount={editClients}
                churnRate={editChurn}
                monthlyRevenue={editRevenue}
                isLocked={isLocked}
                status={hexStatus}
              />
              {isLocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                      <Lock className="h-8 w-8" />
                    </div>
                    <p className="text-sm font-semibold text-brand-700">Débloquez avec Churnly</p>
                    <p className="text-xs text-slate-500">À partir de {formatEuro(currentPrice)}/mois</p>
                  </motion.div>
                </div>
              )}
            </div>
            <p className="mt-4 text-center text-xs text-slate-400">
              Taille: clients · Couleur: churn · Épaisseur: revenue · Vitesse: urgence
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="space-y-5"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Modifier</h2>
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Building2 className="h-3.5 w-3.5" /> Nom de l'entreprise
                  </label>
                  <input
                    type="text"
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <EditField label="Nombre de clients" value={editClients} onChange={setEditClients} min={1} max={10000} step={1} icon={Users} />
                <EditField label="Revenue mensuel" value={editRevenue} onChange={setEditRevenue} min={0} max={1000000} step={1000} suffix="€" icon={Euro} />
                <EditField label="Taux de churn" value={editChurn} onChange={setEditChurn} min={0} max={50} step={0.5} suffix="%" icon={TrendingDown} />
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Building2 className="h-3.5 w-3.5" /> Industrie
                  </label>
                  <input
                    type="text"
                    value={editIndustry}
                    onChange={(e) => setEditIndustry(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-5 w-full rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Mot de passe</h3>
              <form onSubmit={handlePasswordChange} className="mt-4 flex flex-col gap-3">
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Nouveau mot de passe"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="submit"
                  className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700"
                >
                  Mettre à jour
                </button>
              </form>
              {passwordStatus && <p className="mt-2 text-sm text-slate-500">{passwordStatus}</p>}
            </div>

            <button
              onClick={handleLogout}
              className="rounded-full border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Déconnexion
            </button>
          </motion.div>
        </div>
      </main>

      <AnimatePresence>
        {savedToast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
          >
            <Check className="h-4 w-4" /> Infos mises à jour
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
