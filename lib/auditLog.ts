import type { getSupabaseAdmin } from '@/lib/supabase';

export type AuditAction = 'stripe_connected' | 'stripe_disconnected' | 'subscription_tier_changed' | 'referral_reward_applied' | 'prospecting_batch_sent' | 'linkedin_prospect_marked_sent' | 'billing_mode_switched' | 'performance_revenue_billed' | 'performance_invoice_failed';

// Best-effort et jamais bloquant : une entrée de journal manquée ne doit
// jamais faire échouer l'action réelle qu'elle décrit (connexion Stripe,
// changement de palier...). Écrit toujours via le client service-role —
// voir la migration correspondante pour pourquoi aucune policy RLS
// n'autorise un utilisateur à écrire dans sa propre table d'audit.
export async function logAuditEvent(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  action: AuditAction,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseAdmin.from('audit_log').insert({ user_id: userId, action, metadata: metadata ?? null });
  if (error) {
    console.error('[audit-log] insert failed', JSON.stringify({ userId, action, error }));
  }
}
