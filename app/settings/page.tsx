'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import MagicHexagon from '@/components/MagicHexagon';
import { EASE_OUT } from '@/lib/animations';
import { Building2, Users, Euro, TrendingDown, Lock, Check, AlertCircle, Link2, ScrollText, X, Key, Webhook, Gift, RefreshCw, Copy, Percent } from 'lucide-react';
import type { HexagonStatus } from '@/components/MagicHexagon';
import { useLanguage, useTranslations } from '@/lib/i18n/LanguageContext';
import { resolveAccountIdClient } from '@/lib/team';

interface Profile {
  company_name: string;
  subscription_tier: string | null;
  subscription_status: string;
  client_count: number | null;
  monthly_revenue: number | null;
  industry: string | null;
  business_description: string | null;
  churn_rate: number | null;
  stripe_connected: boolean;
  intercom_connected: boolean;
  stripe_connect_account_id: string | null;
  analysis_frequency: string;
  billing_mode: 'revenue_tier' | 'performance';
  performance_billing_started_at: string | null;
}

interface AuditLogEntry {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface TeamMemberRow {
  id: string;
  invited_email: string;
  status: 'pending' | 'accepted';
  created_at: string;
  email_status: 'pending' | 'sent' | 'failed';
  expires_at: string;
  invite_token: string;
}

interface ApiKeyRow {
  id: string;
  key_prefix: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
}

interface WebhookRow {
  id: string;
  url: string;
  enabled: boolean;
  created_at: string;
}

import { calcPrice, formatEuro } from '@/lib/pricing';

function auditActionLabel(
  entry: AuditLogEntry,
  labels: {
    stripeConnected: string;
    stripeDisconnected: string;
    subscriptionTierChanged: (fromTier: string, toTier: string) => string;
    referralRewardApplied: () => string;
  },
): string {
  if (entry.action === 'stripe_connected') return labels.stripeConnected;
  if (entry.action === 'stripe_disconnected') return labels.stripeDisconnected;
  if (entry.action === 'subscription_tier_changed') {
    const meta = entry.metadata ?? {};
    return labels.subscriptionTierChanged(String(meta.fromTier ?? '—'), String(meta.toTier ?? '—'));
  }
  if (entry.action === 'referral_reward_applied') {
    return labels.referralRewardApplied();
  }
  return entry.action;
}

function EditField({
  label, value, onChange, suffix, min, max, step, icon: Icon,
}: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string;
  min: number; max: number; step: number; icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
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
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        {suffix && <span className="text-xs text-slate-400 dark:text-slate-500">{suffix}</span>}
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
  const [onboarding, setOnboarding] = useState(false);

  const [editClients, setEditClients] = useState(100);
  const [editRevenue, setEditRevenue] = useState(50000);
  const [editCompany, setEditCompany] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editBusinessDescription, setEditBusinessDescription] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<'idle' | 'connecting' | 'disconnecting'>('idle');
  const [stripeMessage, setStripeMessage] = useState('');
  const [analysisFrequency, setAnalysisFrequency] = useState('daily');
  const [analysisFrequencyStatus, setAnalysisFrequencyStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const analysisFrequencyRequestId = useRef(0);
  const [planMessage, setPlanMessage] = useState('');
  const [performanceStats, setPerformanceStats] = useState<{ treatmentCount: number; controlCount: number; treatedResolvedCount: number; controlResolvedCount: number; incrementalRevenue: number; estimatedFee: number; feeRate: number } | null>(null);
  const [switchingBillingMode, setSwitchingBillingMode] = useState(false);
  const [billingModeMessage, setBillingModeMessage] = useState('');
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [inviteMessage, setInviteMessage] = useState('');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [newApiKey, setNewApiKey] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [webhookMessage, setWebhookMessage] = useState('');
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [referralPayingCount, setReferralPayingCount] = useState(0);
  const { language } = useLanguage();
  const t = useTranslations('settings');

  // 'trialing' oublié ici verrouillerait la visualisation pour un compte
  // pourtant déjà en essai gratuit actif — même règle que le dashboard.
  const isLocked = profile?.subscription_status !== 'active' && profile?.subscription_status !== 'trialing';

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('onboarding') === '1') {
      setOnboarding(true);
    }

    // Retour OAuth (Google) : voir la note équivalente dans app/dashboard/page.tsx —
    // on remonte l'erreur exacte à /login plutôt que de rediriger silencieusement.
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : '');
    const oauthErrorDescription = hashParams.get('error_description') || hashParams.get('error');
    const hadAccessToken = hashParams.has('access_token');

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) {
        if (oauthErrorDescription) {
          router.replace(`/login?oauth_error=${encodeURIComponent(oauthErrorDescription)}`);
        } else if (hadAccessToken) {
          router.replace('/login?oauth_error=session_not_created');
        } else {
          router.replace('/login');
        }
        return;
      }

      // Le compte ambassadeur (ADMIN_EMAILS) n'a pas de profil business à
      // configurer ici — direction /admin, voir la note équivalente dans
      // app/dashboard/page.tsx.
      const { data: sessionDataForAdminCheck } = await supabase.auth.getSession();
      const adminCheck = await fetch('/api/admin/check', {
        headers: { Authorization: `Bearer ${sessionDataForAdminCheck?.session?.access_token}` },
      }).then((r) => r.json()).catch(() => ({ isAdmin: false }));
      if (adminCheck.isAdmin) { router.replace('/admin'); return; }

      // La facturation, le profil d'entreprise et Stripe Connect restent
      // réservés au propriétaire du compte — un membre d'équipe accepté est
      // renvoyé directement vers /dashboard plutôt que de voir une page
      // /settings partiellement utilisable pour lui.
      const resolvedAccountId = await resolveAccountIdClient(supabase, data.user.id);
      if (resolvedAccountId !== data.user.id) { router.replace('/dashboard'); return; }
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
      setEditCompany(p?.company_name ?? '');
      setEditIndustry(p?.industry ?? '');
      setEditBusinessDescription(p?.business_description ?? '');
      setStripeConnected(!!p?.stripe_connect_account_id);
      setAnalysisFrequency(p?.analysis_frequency ?? 'daily');
      setLoading(false);

      {
        // Toujours appelé, même hors mode performance — sans effet pour un
        // compte classique (aucun échantillon n'existe tant qu'il n'a pas
        // basculé, voir churn_recovery_samples dans lib/analysis.ts) donc
        // performanceStats reste vide, ce qui masque simplement le bloc
        // d'affichage plus bas.
        const { data: sessionDataForBilling } = await supabase.auth.getSession();
        const billingToken = sessionDataForBilling?.session?.access_token;
        const statsRes = await fetch('/api/settings/billing-mode', { headers: { Authorization: `Bearer ${billingToken}` } });
        if (statsRes.ok) setPerformanceStats(await statsRes.json());
      }

      const { data: logRows } = await supabase
        .from('audit_log')
        .select('id, action, metadata, created_at')
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setAuditLog((logRows ?? []) as AuditLogEntry[]);

      const { data: memberRows } = await supabase
        .from('team_members')
        .select('id, invited_email, status, created_at, email_status, expires_at, invite_token')
        .eq('owner_user_id', data.user.id)
        .order('created_at', { ascending: false });
      setTeamMembers((memberRows ?? []) as TeamMemberRow[]);

      const { data: keyRows } = await supabase
        .from('api_keys')
        .select('id, key_prefix, label, created_at, last_used_at')
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: false });
      setApiKeys((keyRows ?? []) as ApiKeyRow[]);

      const { data: webhookRows } = await supabase
        .from('webhooks')
        .select('id, url, enabled, created_at')
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: false });
      setWebhooks((webhookRows ?? []) as WebhookRow[]);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const referralRes = await fetch('/api/referrals/count', { headers: { Authorization: `Bearer ${token}` } });
      if (referralRes.ok) {
        const referralResult = await referralRes.json();
        setReferralCode(referralResult.code ?? null);
        setReferralCount(referralResult.count ?? 0);
        setReferralPayingCount(referralResult.payingCount ?? 0);
      }
    });
  }, [router]);

  async function handleCreateApiKey() {
    if (!user) return;
    setCreatingKey(true);
    setNewApiKey('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result.key) {
        setNewApiKey(result.key);
        const { data: keyRows } = await supabase
          .from('api_keys')
          .select('id, key_prefix, label, created_at, last_used_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        setApiKeys((keyRows ?? []) as ApiKeyRow[]);
      }
    } catch {
      // best-effort
    }
    setCreatingKey(false);
  }

  async function handleRevokeApiKey(keyId: string) {
    if (!user) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const res = await fetch('/api/api-keys/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ keyId }),
    });
    if (res.ok) setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
  }

  async function handleAddWebhook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setWebhookStatus('sending');
    setWebhookMessage('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWebhookStatus('error');
        setWebhookMessage(result.error || t.webhooks.addError);
        return;
      }
      setWebhookUrl('');
      setWebhookStatus('idle');
      const { data: webhookRows } = await supabase
        .from('webhooks')
        .select('id, url, enabled, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setWebhooks((webhookRows ?? []) as WebhookRow[]);
    } catch {
      setWebhookStatus('error');
      setWebhookMessage(t.webhooks.addError);
    }
  }

  async function handleRemoveWebhook(webhookId: string) {
    if (!user) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const res = await fetch('/api/webhooks/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ webhookId }),
    });
    if (res.ok) setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
  }

  async function sendInvite(email: string): Promise<{ ok: boolean; emailStatus?: 'sent' | 'failed'; error?: string }> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, language }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: result.error };
      return { ok: true, emailStatus: result.emailStatus };
    } catch {
      return { ok: false };
    }
  }

  async function refreshTeamMembers() {
    if (!user) return;
    const { data: memberRows } = await supabase
      .from('team_members')
      .select('id, invited_email, status, created_at, email_status, expires_at, invite_token')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false });
    setTeamMembers((memberRows ?? []) as TeamMemberRow[]);
  }

  async function handleInviteMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !inviteEmail) return;
    setInviteStatus('sending');
    setInviteMessage('');
    const result = await sendInvite(inviteEmail);
    if (!result.ok) {
      setInviteStatus('error');
      setInviteMessage(result.error || t.team.inviteError);
      return;
    }
    setInviteEmail('');
    setInviteStatus('idle');
    setInviteMessage(result.emailStatus === 'failed' ? t.team.inviteEmailFailed : t.team.inviteSent);
    await refreshTeamMembers();
  }

  async function handleResendInvite(member: TeamMemberRow) {
    setResendingId(member.id);
    const result = await sendInvite(member.invited_email);
    setResendingId(null);
    if (result.ok) {
      setInviteMessage(result.emailStatus === 'failed' ? t.team.inviteEmailFailed : t.team.inviteResent);
      await refreshTeamMembers();
    }
  }

  function handleCopyInviteLink(member: TeamMemberRow) {
    const url = `${window.location.origin}/api/team/accept?token=${member.invite_token}&lang=${language}`;
    navigator.clipboard.writeText(url);
    setCopiedId(member.id);
    setTimeout(() => setCopiedId((id) => (id === member.id ? null : id)), 2000);
  }

  async function handleRemoveMember(memberId: string) {
    if (!user) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const res = await fetch('/api/team/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ memberId }),
    });
    if (res.ok) {
      setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
  }

  const handleSave = useCallback(async () => {
    if (!user) return;
    // Même seuil que /signup (voir app/signup/page.tsx handleStep3Next) : une
    // description trop courte ou vide prive l'IA du contexte dont elle a
    // besoin pour calibrer ses seuils de risque par type de produit (voir
    // businessContextInstruction dans lib/claude.ts).
    if (editBusinessDescription.trim().length < 15) {
      setError(t.businessDescriptionTooShort);
      return;
    }
    setSaving(true);
    setError('');
    setPlanMessage('');
    setHexStatus('loading');
    const { error: updateError } = await supabase
      .from('users')
      .update({
        company_name: editCompany,
        client_count: editClients,
        monthly_revenue: editRevenue,
        industry: editIndustry,
        business_description: editBusinessDescription.trim(),
      })
      .eq('id', user.id);

    if (updateError) {
      setSaving(false);
      setError(t.updateError);
      setHexStatus('error');
      setTimeout(() => setHexStatus('idle'), 3000);
      return;
    }

    // Un client déjà abonné doit voir son abonnement Stripe suivre ces
    // nouvelles valeurs — sinon les modifier ici ne change rien à ce qu'il
    // paie réellement. Best-effort : ses infos sont déjà enregistrées même
    // si cet ajustement échoue.
    if (profile?.billing_mode !== 'performance' && (profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing')) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const response = await fetch('/api/update-subscription-tier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          setPlanMessage(t.planUpdateError);
        } else if (result.updated) {
          setProfile((prev) => (prev ? { ...prev, subscription_tier: String(result.tier) } : prev));
          setPlanMessage(t.planUpdated(formatEuro(Number(result.tier))));
        }
      } catch {
        setPlanMessage(t.planUpdateError);
      }
    }

    setSaving(false);
    setSavedToast(true);
    setHexStatus('success');
    setTimeout(() => setSavedToast(false), 3000);
    setTimeout(() => setHexStatus('idle'), 2500);
  }, [user, editCompany, editClients, editRevenue, editIndustry, editBusinessDescription, profile?.subscription_status, profile?.billing_mode, t]);

  async function handleSwitchBillingMode() {
    if (!window.confirm(t.performanceBilling.confirmSwitch)) return;
    setSwitchingBillingMode(true);
    setBillingModeMessage('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/settings/billing-mode', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || t.performanceBilling.switchError);
      setProfile((prev) => (prev ? { ...prev, billing_mode: 'performance', subscription_tier: null } : prev));
      const statsRes = await fetch('/api/settings/billing-mode', { headers: { Authorization: `Bearer ${token}` } });
      if (statsRes.ok) setPerformanceStats(await statsRes.json());
    } catch (err) {
      setBillingModeMessage(err instanceof Error ? err.message : t.performanceBilling.switchError);
    } finally {
      setSwitchingBillingMode(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordStatus('');
    const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordStatus(pwError ? t.passwordUpdateError : t.passwordUpdated);
    if (!pwError) setNewPassword('');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function handleConnectStripe() {
    setStripeStatus('connecting');
    setStripeMessage('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch('/api/stripe/connect/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(t.stripeConnectError);
      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setStripeStatus('idle');
      setStripeMessage(err instanceof Error ? err.message : t.stripeConnectError);
    }
  }

  async function handleDisconnectStripe() {
    setStripeStatus('disconnecting');
    setStripeMessage('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch('/api/stripe/connect/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(t.stripeDisconnectError);
      setStripeConnected(false);
      setStripeMessage(t.stripeDisconnected);
    } catch (err) {
      setStripeMessage(err instanceof Error ? err.message : t.stripeDisconnectError);
    } finally {
      setStripeStatus('idle');
    }
  }

  async function handleAnalysisFrequencyChange(value: string) {
    if (!user) return;
    const previous = analysisFrequency;
    // Un id de requête plutôt qu'un simple booléen "en cours" : si
    // l'utilisateur change deux fois rapidement (ex: quotidien -> hebdo ->
    // mensuel) et que la 1ère requête échoue après que la 2ème ait déjà
    // réussi, sa réponse (en retard) ne doit pas écraser l'état déjà à jour
    // avec la valeur "previous" qu'elle avait capturée avant d'être envoyée.
    const requestId = ++analysisFrequencyRequestId.current;
    setAnalysisFrequency(value);
    setAnalysisFrequencyStatus('saving');
    const { error } = await supabase.from('users').update({ analysis_frequency: value }).eq('id', user.id);
    if (analysisFrequencyRequestId.current !== requestId) return;
    if (error) {
      setAnalysisFrequency(previous);
      setAnalysisFrequencyStatus('error');
      return;
    }
    setAnalysisFrequencyStatus('idle');
  }

  if (loading || !user) {
    return (
      <>
        <Navigation user={user} />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="relative h-[400px] w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
            <MagicHexagon clientCount={100} churnRate={5} monthlyRevenue={50000} status="loading" />
          </div>
        </div>
      </>
    );
  }

  const currentPrice = calcPrice(editRevenue);
  const industryLabels = t.industries;

  const staticInfo = [
    { label: t.infoLabels.company, value: profile?.company_name || '—', icon: Building2 },
    { label: t.infoLabels.clients, value: (profile?.client_count ?? 0).toString(), icon: Users },
    { label: t.infoLabels.monthlyRevenue, value: formatEuro(profile?.monthly_revenue ?? 0), icon: Euro },
    { label: t.infoLabels.industry, value: (profile?.industry && industryLabels[profile.industry]) || '—', icon: Building2 },
    { label: t.infoLabels.businessDescription, value: profile?.business_description || '—', icon: Building2 },
    {
      label: t.infoLabels.churnRate,
      value: profile?.churn_rate != null ? `${profile.churn_rate.toFixed(1)}%` : t.infoLabels.notAnalyzedYet,
      icon: TrendingDown,
    },
  ];

  return (
    <>
      <Navigation user={user} />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="mb-10 text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          {t.title}
        </motion.h1>

        {onboarding && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="relative z-10 mb-8 flex flex-col items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4 dark:border-brand-800/60 dark:bg-brand-500/10 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.onboardingBanner.title}</p>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{t.onboardingBanner.body}</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex flex-shrink-0 items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 dark:hover:bg-brand-500"
            >
              {t.onboardingBanner.cta}
            </button>
          </motion.div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="space-y-6 lg:col-span-2"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.edit}</h2>
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <Building2 className="h-3.5 w-3.5" /> {t.companyNameLabel}
                  </label>
                  <input
                    type="text"
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <EditField label={t.clientCountLabel} value={editClients} onChange={setEditClients} min={1} max={10000} step={1} icon={Users} />
                <EditField label={t.monthlyRevenueLabel} value={editRevenue} onChange={setEditRevenue} min={0} max={1000000} step={1000} suffix="€" icon={Euro} />
                <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <TrendingDown className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  {t.churnRateNote}
                </p>
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <Building2 className="h-3.5 w-3.5" /> {t.industryLabel}
                  </label>
                  <select
                    value={editIndustry}
                    onChange={(e) => setEditIndustry(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {Object.entries(industryLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <Building2 className="h-3.5 w-3.5" /> {t.businessDescriptionLabel}
                  </label>
                  <textarea
                    rows={3}
                    value={editBusinessDescription}
                    onChange={(e) => setEditBusinessDescription(e.target.value)}
                    placeholder={t.businessDescriptionPlaceholder}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{t.businessDescriptionHint}</p>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-5 w-full rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60 dark:hover:bg-brand-500"
              >
                {saving ? t.saving : t.save}
              </button>
              {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
              {planMessage && (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{planMessage}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.passwordTitle}</h3>
                <form onSubmit={handlePasswordChange} className="mt-4 flex flex-col gap-3">
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder={t.newPasswordPlaceholder}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 dark:hover:bg-brand-500"
                  >
                    {t.updatePassword}
                  </button>
                </form>
                {passwordStatus && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{passwordStatus}</p>}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.stripeConnectTitle}</h3>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.stripeConnectDescription}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${stripeConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    <AlertCircle className="h-3.5 w-3.5" />
                    {stripeConnected ? t.stripeConnectedLabel : t.stripeNotConnectedLabel}
                  </span>
                  {stripeConnected ? (
                    <button
                      onClick={handleDisconnectStripe}
                      disabled={stripeStatus === 'disconnecting'}
                      className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {stripeStatus === 'disconnecting' ? t.stripeDisconnecting : t.stripeDisconnectButton}
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectStripe}
                      disabled={stripeStatus === 'connecting'}
                      className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 dark:hover:bg-brand-500"
                    >
                      {stripeStatus === 'connecting' ? t.stripeConnecting : t.stripeConnectButton}
                    </button>
                  )}
                </div>
                {stripeMessage && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{stripeMessage}</p>}
                {stripeConnected && (
                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t.analysisFrequency.label}
                    </label>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.analysisFrequency.description}</p>
                    <select
                      value={analysisFrequency}
                      onChange={(e) => handleAnalysisFrequencyChange(e.target.value)}
                      disabled={analysisFrequencyStatus === 'saving'}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white"
                    >
                      <option value="daily">{t.analysisFrequency.daily}</option>
                      <option value="weekly">{t.analysisFrequency.weekly}</option>
                      <option value="monthly">{t.analysisFrequency.monthly}</option>
                      <option value="manual">{t.analysisFrequency.manual}</option>
                    </select>
                    {analysisFrequencyStatus === 'error' && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">{t.analysisFrequency.error}</p>
                    )}
                  </div>
                )}
                {!stripeConnected && (
                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.analysisFrequency.csvNote}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.team.title}</h3>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.team.description}</p>

                {teamMembers.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {teamMembers.map((member) => {
                      const isExpired = member.status === 'pending' && new Date(member.expires_at).getTime() < Date.now();
                      const statusLabel = member.status === 'accepted'
                        ? t.team.statusAccepted
                        : isExpired
                          ? t.team.statusExpired
                          : member.email_status === 'failed'
                            ? t.team.statusEmailFailed
                            : t.team.statusPending;
                      const statusClass = member.status === 'accepted'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isExpired || member.email_status === 'failed'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-500 dark:text-slate-400';
                      return (
                        <li key={member.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm dark:bg-slate-800/60">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900 dark:text-white">{member.invited_email}</p>
                            <p className={`text-xs ${statusClass}`}>{statusLabel}</p>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-1">
                            {member.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleCopyInviteLink(member)}
                                  className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                                  aria-label={t.team.copyLinkButton}
                                  title={copiedId === member.id ? t.team.linkCopied : t.team.copyLinkButton}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleResendInvite(member)}
                                  disabled={resendingId === member.id}
                                  className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 disabled:opacity-60 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                                  aria-label={t.team.resendButton}
                                  title={t.team.resendButton}
                                >
                                  <RefreshCw className={`h-3.5 w-3.5 ${resendingId === member.id ? 'animate-spin' : ''}`} />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                              aria-label={t.team.removeButton}
                              title={t.team.removeButton}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <form onSubmit={handleInviteMember} className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    required
                    placeholder={t.team.emailPlaceholder}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={inviteStatus === 'sending'}
                    className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60 dark:hover:bg-brand-500"
                  >
                    {inviteStatus === 'sending' ? t.team.inviting : t.team.inviteButton}
                  </button>
                </form>
                {inviteMessage && (
                  <p className={`mt-2 text-sm ${inviteStatus === 'error' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>{inviteMessage}</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.apiKeys.title}</h3>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.apiKeys.description}</p>

                {newApiKey && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-500/10">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">{t.apiKeys.newKeyWarning}</p>
                    <code className="mt-1.5 block break-all rounded-lg bg-white px-2.5 py-2 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">{newApiKey}</code>
                  </div>
                )}

                {apiKeys.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {apiKeys.map((key) => (
                      <li key={key.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm dark:bg-slate-800/60">
                        <div>
                          <code className="font-medium text-slate-900 dark:text-white">{key.key_prefix}…</code>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {key.last_used_at ? t.apiKeys.lastUsed(new Date(key.last_used_at).toLocaleDateString()) : t.apiKeys.neverUsed}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRevokeApiKey(key.id)}
                          className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                          aria-label={t.apiKeys.revokeButton}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  onClick={handleCreateApiKey}
                  disabled={creatingKey}
                  className="mt-4 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60 dark:hover:bg-brand-500"
                >
                  {creatingKey ? t.apiKeys.creating : t.apiKeys.createButton}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <Webhook className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.webhooks.title}</h3>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.webhooks.description}</p>

                {webhooks.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {webhooks.map((webhook) => (
                      <li key={webhook.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm dark:bg-slate-800/60">
                        <span className="truncate font-medium text-slate-900 dark:text-white">{webhook.url}</span>
                        <button
                          onClick={() => handleRemoveWebhook(webhook.id)}
                          className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                          aria-label={t.webhooks.removeButton}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <form onSubmit={handleAddWebhook} className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="url"
                    required
                    placeholder={t.webhooks.urlPlaceholder}
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={webhookStatus === 'sending'}
                    className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60 dark:hover:bg-brand-500"
                  >
                    {webhookStatus === 'sending' ? t.webhooks.adding : t.webhooks.addButton}
                  </button>
                </form>
                {webhookMessage && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{webhookMessage}</p>
                )}
              </div>

              {referralCode && (
                <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <Gift className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.referral.title}</h3>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.referral.description}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <code className="flex-1 truncate rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                      {typeof window !== 'undefined' ? `${window.location.origin}/signup?ref=${referralCode}` : ''}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/signup?ref=${referralCode}`)}
                      className="shrink-0 rounded-full border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {t.referral.copyButton}
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{t.referral.countLabel(referralCount)}</p>
                  {referralPayingCount > 0 && (
                    <div className="mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/60">
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t.referral.payingLabel(referralPayingCount)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {auditLog.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <ScrollText className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.auditLog.title}</h3>
                </div>
                <ul className="mt-3 space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                  {auditLog.map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-3 border-b border-slate-50 pb-2.5 last:border-0 last:pb-0 dark:border-slate-800">
                      <span>{auditActionLabel(entry, t.auditLog.actions)}</span>
                      <span className="shrink-0 text-slate-400 dark:text-slate-500">
                        {new Date(entry.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="rounded-full border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t.logout}
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="space-y-4 lg:sticky lg:top-24 lg:self-start"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.currentProfile}</h2>
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {staticInfo.map((item) => (
                <div key={item.label} className="flex items-center justify-between border-b border-slate-50 py-3 last:border-0 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <item.icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-6 shadow-sm dark:border-brand-800/40 dark:bg-brand-500/5">
              <h3 className="text-sm font-semibold text-brand-700 dark:text-brand-400">{t.yourPrice}</h3>
              <motion.p
                key={currentPrice}
                initial={{ opacity: 0.5, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-2 text-4xl font-extrabold text-brand-700 dark:text-brand-400"
              >
                {formatEuro(currentPrice)}<span className="text-base font-medium text-slate-400 dark:text-slate-500">{t.perMonth}</span>
              </motion.p>
              <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                {isLocked ? t.priceNote : t.priceNoteSubscribed}
              </p>
            </div>

            {/* Le 20% mesuré via groupe témoin s'applique désormais aux deux
                plans (Standard 'revenue_tier' et 'performance', voir
                lib/pricing.ts) — ce bloc de stats est donc affiché pour tout
                compte abonné, plus seulement pour le mode performance pur. */}
            {!isLocked && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-6 shadow-sm dark:border-emerald-800/40 dark:bg-emerald-500/5">
                <div className="mb-2 flex items-center gap-2">
                  <Percent className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{t.performanceBilling.title}</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {profile?.billing_mode === 'performance' ? t.performanceBilling.activePerformance : t.performanceBilling.activeStandard}
                </p>
                {performanceStats && (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{t.performanceBilling.sampleLabel}</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {performanceStats.treatedResolvedCount}/{performanceStats.treatmentCount} · {performanceStats.controlResolvedCount}/{performanceStats.controlCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{t.performanceBilling.nextInvoiceLabel}</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{formatEuro(performanceStats.estimatedFee)}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">{t.performanceBilling.sampleHint}</p>
                  </>
                )}
              </div>
            )}

            {!isLocked && profile?.billing_mode !== 'performance' && (
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-2 flex items-center gap-2">
                  <Percent className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t.performanceBilling.title}</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.performanceBilling.pitch}</p>
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{t.performanceBilling.controlGroupDisclosure}</p>
                <button
                  onClick={handleSwitchBillingMode}
                  disabled={switchingBillingMode}
                  className="mt-3 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {switchingBillingMode ? t.performanceBilling.switching : t.performanceBilling.switchButton}
                </button>
                {billingModeMessage && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{billingModeMessage}</p>}
              </div>
            )}

            <div className="relative flex flex-col items-center justify-center">
              <div className="relative h-[320px] w-full overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
                <MagicHexagon
                  clientCount={editClients}
                  churnRate={profile?.churn_rate ?? undefined}
                  monthlyRevenue={editRevenue}
                  isLocked={isLocked}
                  status={hexStatus}
                />
                {isLocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm dark:bg-slate-950/40">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="flex flex-col items-center gap-3"
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                        <Lock className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">{t.unlockWithChurnly}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t.startingAt} {formatEuro(currentPrice)}{t.perMonth}</p>
                    </motion.div>
                  </div>
                )}
              </div>
              <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
                {t.legend}
              </p>
            </div>
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
            <Check className="h-4 w-4" /> {t.savedToast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
