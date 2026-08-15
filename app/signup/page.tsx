'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { EASE_OUT } from '@/lib/animations';
import { Building2, Users, Euro, Briefcase, Star, ArrowRight, ArrowLeft, Check, Loader2, AlertTriangle, Mail } from 'lucide-react';
import { calcPricing, calcManagerPrice, formatEuro, ASSUMED_CHURN_RATE } from '@/lib/pricing';
import { useLanguage, useTierName, useTranslations } from '@/lib/i18n/LanguageContext';

type Industry = 'saas' | 'agency' | 'ecommerce' | 'manager' | 'other';

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
  const [industry, setIndustry] = useState<Industry>('saas');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const t = useTranslations('signup');
  const tierName = useTierName();
  const { language } = useLanguage();

  const steps = t.steps;
  const INDUSTRY_LABELS = t.industries;

  const pwStrengthKey: 'weak' | 'medium' | 'strong' | null = (() => {
    if (!password) return null;
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return 'weak';
    if (score <= 3) return 'medium';
    return 'strong';
  })();
  const pwStrength = pwStrengthKey
    ? {
        label: t.passwordStrength[pwStrengthKey],
        color: pwStrengthKey === 'strong' ? 'text-emerald-500' : pwStrengthKey === 'medium' ? 'text-amber-500' : 'text-red-500',
      }
    : { label: '', color: '' };

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  async function sendCode() {
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t.errors.invalidEmail);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action: 'send', language }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t.errors.sendCodeError);
      }
      setCodeSent(true);
      setResendCooldown(30);
      setStep(1);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.generic);
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
        body: JSON.stringify({ email, code: fullCode, action: 'verify', language }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t.errors.invalidCode);
      }
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.generic);
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
      setError(t.errors.passwordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.errors.passwordMismatch);
      return;
    }
    setStep(3);
  }

  async function handleCreateAccount() {
    setError('');
    setLoading(true);

    // La création du compte passe par une route serveur qui vérifie que le
    // code à 4 chiffres a bien été validé pour cet email avant de créer quoi
    // que ce soit — supabase.auth.signUp() n'est jamais appelé directement
    // depuis le navigateur, sinon cette vérification serait purement
    // cosmétique (contournable en appelant l'API Supabase directement).
    const completeRes = await fetch('/api/complete-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, companyName, clientCount, monthlyRevenue, industry, language }),
    });

    if (!completeRes.ok) {
      const data = await completeRes.json().catch(() => ({}));
      setError(data.error || t.errors.cannotCreateAccount);
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.signInWithPassword({ email, password });

    if (sessionData.user) {
      const { data: sessionForToken } = await supabase.auth.getSession();
      const token = sessionForToken?.session?.access_token;
      if (token) {
        fetch('/api/verify-company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ companyName, clientCount, monthlyRevenue }),
        }).catch(() => {
          // best-effort enrichment, never blocks signup
        });
      }

      // Ce profil paie directement (pas d'essai gratuit) : direction Stripe
      // sans passer par la page d'accroche "3 jours gratuits".
      if (isManager) {
        if (!token) {
          setError(t.errors.accountCreatedNoPayment);
          setLoading(false);
          router.push('/dashboard');
          return;
        }
        try {
          const tier = String(calcManagerPrice(clientCount));
          const response = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ tier }),
          });
          if (!response.ok) throw new Error(t.errors.checkoutStartFailed);
          const { url } = await response.json();
          window.location.href = url;
          return;
        } catch (err) {
          setError(err instanceof Error ? err.message : t.errors.accountCreatedPaymentFailed);
          setLoading(false);
          router.push('/dashboard');
          return;
        }
      }
    }

    setLoading(false);
    router.push('/impact');
  }

  const isManager = industry === 'manager';
  const clientCountMin = isManager ? 1 : 5;
  const clientCountMax = isManager ? 50 : 10000;
  const revenueMin = isManager ? 100 : 1000;
  const revenueMax = isManager ? 500000 : 2000000;
  const revenueStep = isManager ? 100 : 1000;

  const pricing = calcPricing(monthlyRevenue);
  const displayedTier = isManager ? calcManagerPrice(clientCount) : pricing.monthly;
  // On ne demande jamais le vrai taux de churn avant l'inscription (personne
  // ne le connaît). Cet écran est une illustration basée sur une moyenne
  // sectorielle — le vrai chiffre, calculé par Churnly, n'arrive qu'après
  // la première analyse réelle des données.
  const atRisk = clientCount > 0 ? Math.max(1, Math.round((clientCount * ASSUMED_CHURN_RATE) / 100)) : 0;
  const monthlyLoss = (monthlyRevenue * ASSUMED_CHURN_RATE) / 100;
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
                  i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-600 dark:bg-brand-500/20 dark:text-brand-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                }`}>
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-0.5 w-6 transition-colors duration-300 ${i < step ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                )}
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="step0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
                  <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t.step0.title}</h1>
                  <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{t.step0.subtitle}</p>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.step0.emailLabel}</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && email && sendCode()} className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder={t.step0.emailPlaceholder} />
                      </div>
                    </div>
                  </div>
                  {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
                  <button onClick={sendCode} disabled={loading || !email} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-50">
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {t.step0.sending}</> : <>{t.step0.submit} <ArrowRight className="h-4 w-4" /></>}
                  </button>
                  <p className="mt-6 text-center text-sm text-slate-500">{t.step0.alreadyHaveAccount} <Link href="/login" className="font-medium text-brand-600 hover:underline">{t.step0.login}</Link></p>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
                  <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t.step1.title}</h1>
                  <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{t.step1.subtitlePrefix} <span className="font-semibold text-slate-700 dark:text-slate-200">{email}</span></p>
                  <div className="flex justify-center gap-3">
                    {code.map((digit, i) => (
                      <input key={i} ref={(el) => { codeRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handleCodeChange(i, e.target.value)} onKeyDown={(e) => handleCodeKeyDown(i, e)} onPaste={i === 0 ? handleCodePaste : undefined} className="h-16 w-14 rounded-xl border border-slate-200 text-center text-2xl font-bold text-slate-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                    ))}
                  </div>
                  {error && <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
                  <button onClick={verifyCode} disabled={loading || code.some((c) => !c)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-50">
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {t.step1.verifying}</> : <>{t.step1.submit} <ArrowRight className="h-4 w-4" /></>}
                  </button>
                  <div className="mt-6 flex items-center justify-between">
                    <button onClick={() => setStep(0)} className="flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"><ArrowLeft className="h-4 w-4" /> {t.step1.back}</button>
                    <button onClick={sendCode} disabled={resendCooldown > 0 || loading} className="text-sm text-brand-600 transition hover:underline disabled:opacity-50 dark:text-brand-400">{resendCooldown > 0 ? t.step1.resendIn(resendCooldown) : t.step1.resend}</button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
                  <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t.step2.title}</h1>
                  <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{t.step2.subtitle}</p>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.step2.passwordLabel}</label>
                      <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="••••••••" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.step2.confirmLabel}</label>
                      <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handlePasswordNext()} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="••••••••" />
                    </div>
                    {password && pwStrengthKey && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500 dark:text-slate-400">{t.passwordStrength.label}</span>
                        <span className={`font-semibold ${pwStrength.color}`}>{pwStrength.label}</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className={`h-1.5 w-8 rounded-full ${i <= (pwStrengthKey === 'strong' ? 5 : pwStrengthKey === 'medium' ? 3 : 1) ? (pwStrengthKey === 'strong' ? 'bg-emerald-500' : pwStrengthKey === 'medium' ? 'bg-amber-500' : 'bg-red-500') : 'bg-slate-200 dark:bg-slate-700'}`} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
                  <div className="mt-6 flex gap-3">
                    <button onClick={() => setStep(1)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><ArrowLeft className="h-4 w-4" /> {t.step2.back}</button>
                    <button onClick={handlePasswordNext} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700">{t.step2.continue} <ArrowRight className="h-4 w-4" /></button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
                  <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t.step3.title}</h1>
                  <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{t.step3.subtitle}</p>
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4 dark:border-brand-800/40 dark:bg-brand-500/5">
                      <label className="mb-2 block text-sm font-semibold text-brand-700 dark:text-brand-400">{t.step3.companyLabel}</label>
                      <div className="relative">
                        <Building2 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400 dark:text-brand-500" />
                        <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full rounded-xl border border-brand-200 bg-white py-3.5 pl-12 pr-4 text-lg font-semibold text-slate-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-brand-800/60 dark:bg-slate-900 dark:text-white" placeholder={t.step3.companyPlaceholder} />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.step3.industryLabel}</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(INDUSTRY_LABELS) as Industry[]).map((key) => (
                          <button
                            key={key}
                            onClick={() => {
                              setIndustry(key);
                              const nextMin = key === 'manager' ? 1 : 5;
                              const nextMax = key === 'manager' ? 50 : 10000;
                              setClientCount((c) => Math.max(nextMin, Math.min(nextMax, c)));
                              const nextRevMin = key === 'manager' ? 100 : 1000;
                              const nextRevMax = key === 'manager' ? 500000 : 2000000;
                              setMonthlyRevenue((r) => Math.max(nextRevMin, Math.min(nextRevMax, r)));
                            }}
                            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition ${industry === key ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-400 dark:ring-brand-800' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'}`}
                          >
                            {key === 'saas' && <Briefcase className="h-5 w-5" />}
                            {key === 'agency' && <Users className="h-5 w-5" />}
                            {key === 'ecommerce' && <Building2 className="h-5 w-5" />}
                            {key === 'manager' && <Star className="h-5 w-5" />}
                            {key === 'other' && <Building2 className="h-5 w-5" />}
                            {INDUSTRY_LABELS[key]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">{industry === 'manager' ? t.step3.modelsCountLabel : t.step3.clientsCountLabel}</label>
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <input type="range" min={clientCountMin} max={clientCountMax} step={1} value={clientCount} onChange={(e) => setClientCount(Number(e.target.value))} className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-700" />
                        <input
                          type="number"
                          min={clientCountMin}
                          max={clientCountMax}
                          value={clientCount}
                          onChange={(e) => setClientCount(Number(e.target.value) || 0)}
                          onBlur={(e) => setClientCount(Math.max(clientCountMin, Math.min(clientCountMax, Number(e.target.value) || clientCountMin)))}
                          className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-right text-sm font-semibold text-brand-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-brand-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">{isManager ? t.step3.revenuePerModelLabel : t.step3.revenueLabel}</label>
                      <div className="flex items-center gap-3">
                        <Euro className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <input type="range" min={revenueMin} max={revenueMax} step={revenueStep} value={monthlyRevenue} onChange={(e) => setMonthlyRevenue(Number(e.target.value))} className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-700" />
                        <input
                          type="number"
                          min={revenueMin}
                          max={revenueMax}
                          step={revenueStep}
                          value={monthlyRevenue}
                          onChange={(e) => setMonthlyRevenue(Number(e.target.value) || 0)}
                          onBlur={(e) => setMonthlyRevenue(Math.max(revenueMin, Math.min(revenueMax, Number(e.target.value) || revenueMin)))}
                          className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-right text-sm font-semibold text-brand-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-brand-400"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                    {t.step3.churnNote}
                  </p>
                  {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
                  <div className="mt-6 flex gap-3">
                    <button onClick={() => setStep(2)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><ArrowLeft className="h-4 w-4" /> {t.step3.back}</button>
                    <button onClick={() => setStep(4)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700">{t.step3.analyze} <ArrowRight className="h-4 w-4" /></button>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="step4" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
                  <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t.step4.title}</h1>
                  <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{t.step4.subtitle}</p>
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.4 }} className="mb-4 rounded-2xl border border-red-100 bg-red-50/60 p-5 dark:border-red-800/40 dark:bg-red-950/20">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-400">{t.step4.atRiskRevenue}</p>
                    </div>
                    <p className="mt-2 text-3xl font-extrabold text-red-600 dark:text-red-400">{formatEuro(annualLoss)}</p>
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">{t.step4.annualLossProjected}</p>
                  </motion.div>
                  <div className="mb-3 grid grid-cols-3 gap-3">
                    {[
                      { label: t.step4.statsClients, value: `${clientCount}`, icon: Users, color: 'text-slate-700 dark:text-slate-300' },
                      { label: t.step4.statsAtRisk, value: `${atRisk}`, icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
                      { label: t.step4.statsMrr, value: formatEuro(monthlyRevenue), icon: Euro, color: 'text-slate-700 dark:text-slate-300' },
                    ].map((stat, i) => (
                      <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }} className="rounded-xl border border-slate-100 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900">
                        <stat.icon className={`mx-auto mb-1.5 h-4 w-4 ${stat.color}`} />
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{stat.value}</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{stat.label}</p>
                      </motion.div>
                    ))}
                  </div>
                  <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
                    {t.step4.estimationNote(ASSUMED_CHURN_RATE)}
                  </p>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mb-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <p className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">{t.step4.projectionLabel}</p>
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
                  <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50/50 p-4 dark:border-brand-800/40 dark:bg-brand-500/5">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.step4.yourPrice}</p>
                    <motion.p key={displayedTier} initial={{ opacity: 0.5, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-1 text-2xl font-extrabold text-brand-700 dark:text-brand-400">
                      {formatEuro(displayedTier)}<span className="text-sm font-medium text-slate-400 dark:text-slate-500">{t.step4.perMonth}</span>
                    </motion.p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {isManager ? t.step4.managedModelsLabel(clientCount) : t.step4.tierLabel(tierName(pricing.tierName))}
                    </p>
                  </div>
                  <div className="mb-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <p>{t.step4.arpuLabel} <span className="font-semibold text-slate-700 dark:text-slate-200">{formatEuro(arpu)}</span> {t.step4.arpuSuffix}</p>
                    <p>{t.step4.monthlyLossLabel} <span className="font-semibold text-red-500 dark:text-red-400">{formatEuro(monthlyLoss)}</span></p>
                  </div>
                  {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
                  <div className="mt-6 flex gap-3">
                    <button onClick={() => setStep(3)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><ArrowLeft className="h-4 w-4" /> {t.step4.back}</button>
                    <button onClick={handleCreateAccount} disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60">
                      {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {isManager ? t.step4.redirecting : t.step4.creating}</> : isManager ? <>{t.step4.continueToPayment} <ArrowRight className="h-4 w-4" /></> : <>{t.step4.seeMyImpact} <ArrowRight className="h-4 w-4" /></>}
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
