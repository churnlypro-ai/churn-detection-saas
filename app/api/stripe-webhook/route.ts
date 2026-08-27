import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';
import { rewardReferrerForConversion } from '@/lib/referralRewards';

function mapStripeStatus(status: string): 'trialing' | 'active' | 'canceled' | 'past_due' {
  if (status === 'trialing') return 'trialing';
  if (status === 'active') return 'active';
  if (status === 'canceled' || status === 'incomplete_expired') return 'canceled';
  return 'past_due';
}

interface ActivationResult {
  becamePayingNow: boolean;
  data: { id: string; referred_by: string | null }[] | null;
  error: unknown;
}

// became_paying_at doit être posé une seule fois, à la toute première
// activation — jamais réécrit sur un renouvellement ou une réactivation
// ultérieure (voir lib/referralRewards.ts, qui récompense le parrain
// exactement à ce moment-là).
//
// Stripe garantit une livraison "at-least-once" de ses webhooks — le même
// événement peut arriver deux fois, ou deux événements différents peuvent
// être traités en parallèle par deux invocations concurrentes de cette
// route. Un enchaînement lire-puis-écrire (lire became_paying_at, décider,
// puis écrire) laisse une fenêtre où les deux invocations lisent "pas
// encore payant" avant qu'aucune n'ait écrit — les deux récompenseraient
// alors le parrain. La condition `.is('became_paying_at', null)` posée
// directement dans le WHERE de l'UPDATE ferme cette fenêtre : Postgres
// sérialise les UPDATE concurrents sur la même ligne, donc une seule des
// deux requêtes peut matcher et gagner la course, l'autre matche 0 ligne.
async function applyActivation(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  matchColumn: 'id' | 'stripe_subscription_id',
  matchValue: string,
  fields: Record<string, unknown>,
  newStatus: string,
): Promise<ActivationResult> {
  if (newStatus === 'active') {
    const { data: wonRows, error: wonError } = await supabaseAdmin
      .from('users')
      .update({ ...fields, became_paying_at: new Date().toISOString() })
      .eq(matchColumn, matchValue)
      .is('became_paying_at', null)
      .select('id, referred_by');
    if (wonError) return { becamePayingNow: false, data: null, error: wonError };
    if (wonRows && wonRows.length > 0) {
      return { becamePayingNow: true, data: wonRows, error: null };
    }
  }

  // Pas de première activation à détecter ici (déjà payant auparavant, ou
  // statut qui n'est pas "active") — mise à jour normale des autres champs.
  const { data, error } = await supabaseAdmin
    .from('users')
    .update(fields)
    .eq(matchColumn, matchValue)
    .select('id, referred_by');
  return { becamePayingNow: false, data, error };
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const signature = req.headers.get('stripe-signature');
  const rawBody = Buffer.from(await req.arrayBuffer());

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature ?? '',
      process.env.STRIPE_WEBHOOK_SECRET ?? '',
    );
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 },
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  console.log('[stripe-webhook] received event', event.type, event.id);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        const tier = session.metadata?.tier;
        if (userId && tier && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
          const newStatus = mapStripeStatus(subscription.status);
          const { error, data, becamePayingNow } = await applyActivation(
            supabaseAdmin,
            'id',
            userId,
            {
              subscription_tier: tier,
              subscription_status: newStatus,
              stripe_subscription_id: subscription.id,
              trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
              ...(subscription.trial_end ? { trial_used: true } : {}),
            },
            newStatus,
          );
          if (error) {
            console.error('[stripe-webhook] checkout.session.completed: supabase update failed', JSON.stringify({ userId, error }));
          } else if (!data || data.length === 0) {
            console.error('[stripe-webhook] checkout.session.completed: no user row matched', JSON.stringify({ userId }));
          } else {
            console.log('[stripe-webhook] checkout.session.completed: subscription activated', JSON.stringify({ userId, status: mapStripeStatus(subscription.status) }));
            // Un mois offert au parrain, immédiatement à la première
            // conversion du filleul — pas d'attente d'un lot mensuel.
            if (becamePayingNow && data[0].referred_by) {
              await rewardReferrerForConversion(supabaseAdmin, data[0].referred_by);
            }
          }
        } else {
          console.error(
            '[stripe-webhook] checkout.session.completed: missing metadata, skipped',
            JSON.stringify({ hasUserId: !!userId, hasTier: !!tier, hasSubscription: !!session.subscription }),
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const newStatus = mapStripeStatus(subscription.status);
        const { error, data, becamePayingNow } = await applyActivation(
          supabaseAdmin,
          'stripe_subscription_id',
          subscription.id,
          {
            subscription_status: newStatus,
            trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
            ...(subscription.trial_end ? { trial_used: true } : {}),
          },
          newStatus,
        );
        if (error) {
          console.error('[stripe-webhook] customer.subscription.updated: supabase update failed', JSON.stringify({ subscriptionId: subscription.id, error }));
        } else if (!data || data.length === 0) {
          console.error('[stripe-webhook] customer.subscription.updated: no user row matched', JSON.stringify({ subscriptionId: subscription.id }));
        } else if (becamePayingNow && data[0].referred_by) {
          await rewardReferrerForConversion(supabaseAdmin, data[0].referred_by);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await supabaseAdmin
          .from('users')
          .update({ subscription_status: 'canceled', subscription_tier: null, trial_end: null })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      case 'payment_intent.succeeded':
        break;

      default:
        break;
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
