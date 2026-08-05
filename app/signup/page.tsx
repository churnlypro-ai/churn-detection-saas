'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';
import { Building2, Users, Euro, Briefcase, ArrowRight, ArrowLeft, Check, Loader2, TrendingDown, AlertTriangle, Mail } from 'lucide-react';
import { calcPricing, formatEuro } from '@/lib/pricing';

type Industry = 'saas' | 'agency' | 'ecommerce' | 'other';

const INDUSTRY_LABELS: Record<Industry, string> = {
  saas: 'SaaS',
  agency: 'Agence',
  ecommerce: 'E-commerce',
  other: 'Autre',
};

export default function Signup() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [clientCount, setClientCount] = useState(100);
  const [monthlyRevenue, setMonthlyRevenue] = useState(50000);
  const [churnRate, setChurnRate] = useState(5);
  const [industry, setIndustry] = useState<Industry>('saas');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const steps = ['Email', 'Code', 'Mot de passe', 'Entreprise', 'Analyse'];

  const pwStrength = (() => {
    if (!password) return { label: '', color: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { label: 'Faible', color: 'text-red-500' };
    if (score <= 3) return { label: 'Moyen', color: 'text-amber-500' };
    return { label: 'Fort', color: 'text-emerald-500' };
  })();

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  async function sendCode() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action: 'send' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur envoi du code.');
      }
      setCodeSent(true);
      setResendCooldown(30);
      setStep(1);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur.');
    }
    setLoading(false);
  }

  async function verifyCode() {
    setError('');
    setLoading(true);
    const fullCode = code.join('');
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: fullCode, action: 'verify' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Code incorrect.');
      }
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur.');
    }
    setLoading(false);
  }

  function handleCodeChange(idx: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const newCode = [...code];
    newCode[idx] = val;
    setCode(newCode);
    if (val && idx < 3) codeRefs.current[idx + 1]?.focus();
  }

  function handleCodeKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      codeRefs.current[idx - 1]?.focus();
    }
  }

  function handleCodePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length > 0) {
      const newCode = ['', '', '', ''];
      pasted.split('').forEach((c, i) => { newCode[i] = c; });
      setCode(newCode);
      codeRefs.current[Math.min(pasted.length, 3)]?.focus();
    }
  }

  function handlePasswordNext() {
    setError('');
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setStep(3);
  }

  async function handleCreateAccount() {
    setError('');
    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          company_name: companyName,
          client_count: clientCount,
          monthly_revenue: monthlyRevenue,
          industry,
          churn_rate: churnRate,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.signInWithPassword({ email, password });

    if (sessionData.user) {
      await supabase.from('users').update({
        client_count: clientCount,
        monthly_revenue: monthlyRevenue,
        industry,
        churn_rate: churnRate,
      }).eq('id', sessionData.user.id);
    }

    setLoading(false);
    router.push('/impact');
  }

  const pricing = calcPricing({ clients: clientCount, revenue: monthlyRevenue, churn: churnRate });
  const atRisk = Math.round((clientCount * churnRate) / 100);
  const monthlyLoss = (monthlyRevenue * churnRate) / 100;
  const annualLoss = monthlyLoss * 12;
  const arpu = clientCount > 0 ? monthlyRevenue / clientCount : 0;

  return (
    <>
      <Navigation user={null} />

      <main className="relative flex min-h-[calc(100vh-73px)] items-center justify-center overflow-hidden px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="relative z-10 w-full max-w-lg"
        >
          <div className="mb-8 flex items-center justify-center gap-1.5">
            {steps.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold transition-colors duration-300 ${
                  i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-0.5 w-6 transition-colors duration-300 ${i < step ? 'bg-brand-600' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/40">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="step0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
                  <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Créez votre compte</h1>
                  <p className="mb-6 text-sm text-slate-500">Commencez gratuitement.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && email && sendCode()} className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="vous@entreprise.com" />
                      </div>
                    </div>
                  </div>
                  {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                  <button onClick={sendCode} disabled={loading || !email} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-50">
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</> : <>Recevoir un code <ArrowRight className="h-4 w-4" /></>}
                  </button>
                  <p className="mt-6 text-center text-sm text-slate-500">Déjà inscrit ? <Link href="/login" className="font-medium text-brand-600 hover:underline">Se connecter</Link></p>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
                  <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Vérifiez votre email</h1>
                  <p className="mb-6 text-sm text-slate-500">Code envoyé à <span className="font-semibold text-slate-700">{email}</span></p>
                  <div className="flex justify-center gap-3">
                    {code.map((digit, i) => (
                      <input key={i} ref={(el) => { codeRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handleCodeChange(i, e.target.value)} onKeyDown={(e) => handleCodeKeyDown(i, e)} onPaste={i === 0 ? handleCodePaste : undefined} className="h-16 w-14 rounded-xl border border-slate-200 text-center text-2xl font-bold text-slate-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                    ))}
                  </div>
                  {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
                  <button onClick={verifyCode} disabled={loading || code.some((c) => !c)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-50">
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Vérification…</> : <>Vérifier <ArrowRight className="h-4 w-4" /></>}
                  </button>
                  <div className="mt-6 flex items-center justify-between">
                    <button onClick={() => setStep(0)} className="flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Retour</button>
                    <button onClick={sendCode} disabled={resendCooldown > 0 || loading} className="text-sm text-brand-600 transition hover:underline disabled:opacity-50">{resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : 'Renvoyer le code'}</button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
                  <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Créez votre mot de passe</h1>
                  <p className="mb-6 text-sm text-slate-500">8 caractères minimum.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Mot de passe</label>
                      <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="••••••••" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirmer</label>
                      <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handlePasswordNext()} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="••••••••" />
                    </div>
                    {password && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500">Force:</span>
                        <span className={`font-semibold ${pwStrength.color}`}>{pwStrength.label}</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className={`h-1.5 w-8 rounded-full ${i <= (pwStrength.label === 'Fort' ? 5 : pwStrength.label === 'Moyen' ? 3 : 1) ? (pwStrength.label === 'Fort' ? 'bg-emerald-500' : pwStrength.label === 'Moyen' ? 'bg-amber-500' : 'bg-red-500') : 'bg-slate-200'}`} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                  <div className="mt-6 flex gap-3">
                    <button onClick={() => setStep(1)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> Retour</button>
                    <button onClick={handlePasswordNext} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700">Continuer <ArrowRight className="h-4 w-4" /></button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
                  <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Configurez votre profil</h1>
                  <p className="mb-6 text-sm text-slate-500">Analyse personnalisée.</p>
                  <div className="space-y-5">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Nom de l&apos;entreprise</label>
                      <div className="relative">
                        <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="Acme Inc" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Type d&apos;industrie</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(INDUSTRY_LABELS) as Industry[]).map((key) => (
                          <button key={key} onClick={() => setIndustry(key)} className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition ${industry === key ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-200' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                            {key === 'saas' && <Briefcase className="h-5 w-5" />}
                            {key === 'agency' && <Users className="h-5 w-5" />}
                            {key === 'ecommerce' && <Building2 className="h-5 w-5" />}
                            {key === 'other' && <Building2 className="h-5 w-5" />}
                            {INDUSTRY_LABELS[key]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Nombre de clients</label>
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-slate-400" />
                        <input type="range" min={1} max={10000} step={1} value={clientCount} onChange={(e) => setClientCount(Number(e.target.value))} className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600" />
                        <input type="number" min={1} max={10000} value={clientCount} onChange={(e) => setClientCount(Math.max(1, Math.min(10000, Number(e.target.value))))} className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-right text-sm font-semibold text-brand-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">CA mensuel (€)</label>
                      <div className="flex items-center gap-3">
                        <Euro className="h-4 w-4 text-slate-400" />
                        <input type="range" min={1000} max={1000000} step={1000} value={monthlyRevenue} onChange={(e) => setMonthlyRevenue(Number(e.target.value))} className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600" />
                        <input type="number" min={1000} max={1000000} step={1000} value={monthlyRevenue} onChange={(e) => setMonthlyRevenue(Math.max(1000, Math.min(1000000, Number(e.target.value))))} className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-right text-sm font-semibold text-brand-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Taux de churn mensuel (%)</label>
                      <div className="flex items-center gap-3">
                        <TrendingDown className="h-4 w-4 text-slate-400" />
                        <input type="range" min={1} max={50} step={0.5} value={churnRate} onChange={(e) => setChurnRate(Number(e.target.value))} className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600" />
                        <input type="number" min={1} max={50} step={0.5} value={churnRate} onChange={(e) => setChurnRate(Math.max(1, Math.min(50, Number(e.target.value))))} className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-right text-sm font-semibold text-brand-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                      </div>
                      {churnRate > 50 && <p className="mt-2 text-xs font-medium text-red-500">Vous souffrez vraiment. Churnly peut vous aider.</p>}
                    </div>
                  </div>
                  {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                  <div className="mt-6 flex gap-3">
                    <button onClick={() => setStep(2)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> Retour</button>
                    <button onClick={() => setStep(4)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700">Analyser mes données <ArrowRight className="h-4 w-4" /></button>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="step4" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
                  <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Votre analyse</h1>
                  <p className="mb-6 text-sm text-slate-500">Calculé à partir de vos chiffres réels.</p>
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.4 }} className="mb-4 rounded-2xl border border-red-100 bg-red-50/60 p-5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Revenue à risque</p>
                    </div>
                    <p className="mt-2 text-3xl font-extrabold text-red-600">{formatEuro(annualLoss)}</p>
                    <p className="mt-1 text-xs text-red-500">perte annuelle projetée</p>
                  </motion.div>
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    {[
                      { label: 'Churn', value: `${churnRate}%`, icon: TrendingDown, color: 'text-red-500' },
                      { label: 'Clients à risque', value: `${atRisk}`, icon: Users, color: 'text-amber-600' },
                      { label: 'MRR', value: formatEuro(monthlyRevenue), icon: Euro, color: 'text-slate-700' },
                    ].map((stat, i) => (
                      <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }} className="rounded-xl border border-slate-100 bg-white p-4 text-center">
                        <stat.icon className={`mx-auto mb-1.5 h-4 w-4 ${stat.color}`} />
                        <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">{stat.label}</p>
                      </motion.div>
                    ))}
                  </div>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mb-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="mb-3 text-xs font-medium text-slate-500">Projection sur 12 mois (revenue perdue cumulée)</p>
                    <div className="flex h-24 items-end gap-1">
                      {Array.from({ length: 12 }, (_, i) => {
                        const cumulative = monthlyLoss * (i + 1);
                        const maxLoss = monthlyLoss * 12;
                        return (
                          <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${(cumulative / maxLoss) * 100}%` }} transition={{ delay: 0.7 + i * 0.05, duration: 0.3 }} className="flex-1 rounded-t bg-brand-500/70" />
                        );
                      })}
                    </div>
                  </motion.div>
                  <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
                    <p className="text-xs font-medium text-slate-500">Votre prix Churnly</p>
                    <motion.p key={pricing.monthly} initial={{ opacity: 0.5, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-1 text-2xl font-extrabold text-brand-700">
                      {formatEuro(pricing.monthly)}<span className="text-sm font-medium text-slate-400">/mois</span>
                    </motion.p>
                    <p className="mt-1 text-xs text-slate-500">Score: {pricing.score.toFixed(1)} · Palier: {pricing.tierName} · Annulable à tout moment.</p>
                  </div>
                  <div className="mb-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
                    <p>ARPU: <span className="font-semibold text-slate-700">{formatEuro(arpu)}</span> / client</p>
                    <p>Perte mensuelle: <span className="font-semibold text-red-500">{formatEuro(monthlyLoss)}</span></p>
                  </div>
                  {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                  <div className="mt-6 flex gap-3">
                    <button onClick={() => setStep(3)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> Retour</button>
                    <button onClick={handleCreateAccount} disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60">
                      {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Création…</> : <>Voir mon impact <ArrowRight className="h-4 w-4" /></>}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>
    </>
  );
}
