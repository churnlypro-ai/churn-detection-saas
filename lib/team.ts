import type { SupabaseClient } from '@supabase/supabase-js';
import type { getSupabaseAdmin } from '@/lib/supabase';

// Un membre d'équipe est un compte auth à part entière, mais toutes les
// données (analyses, uploads, actions...) restent rattachées au user_id du
// PROPRIÉTAIRE — jamais dupliquées. Chaque route qui scope une requête par
// "userId" doit donc résoudre le vrai compte concerné avant de l'utiliser :
// pour un propriétaire c'est son propre id, pour un membre accepté c'est
// l'id du propriétaire auquel il appartient. Utilisé côté serveur (routes
// API, service role) — voir resolveAccountIdClient pour l'équivalent
// utilisable depuis un composant 'use client'.
export async function resolveAccountId(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  authUserId: string,
): Promise<string> {
  const { data } = await supabaseAdmin
    .from('team_members')
    .select('owner_user_id')
    .eq('member_user_id', authUserId)
    .eq('status', 'accepted')
    .maybeSingle();
  return data?.owner_user_id ?? authUserId;
}

// Même résolution, mais via le client Supabase du navigateur (RLS
// applicable : un utilisateur ne peut lire que les lignes team_members où
// il est propriétaire ou membre, voir la migration correspondante).
export async function resolveAccountIdClient(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<string> {
  const { data } = await supabase
    .from('team_members')
    .select('owner_user_id')
    .eq('member_user_id', authUserId)
    .eq('status', 'accepted')
    .maybeSingle();
  return data?.owner_user_id ?? authUserId;
}

// Certaines actions (facturation, Stripe Connect, clés API, webhooks) ne
// doivent JAMAIS être déclenchables par un membre d'équipe, même par
// accident — contrairement à resolveAccountId qui redirige poliment vers le
// bon compte, celle-ci authentifie le token puis rejette purement et
// simplement l'appel si l'appelant est un membre plutôt qu'un propriétaire.
export async function requireOwnerId(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  token: string,
): Promise<string | null> {
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) return null;

  const { data: membership } = await supabaseAdmin
    .from('team_members')
    .select('id')
    .eq('member_user_id', userData.user.id)
    .eq('status', 'accepted')
    .maybeSingle();
  if (membership) return null;

  return userData.user.id;
}
