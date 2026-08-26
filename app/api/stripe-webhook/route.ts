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

// became_paying_at doit être posé une seule fois, à la toute première
// activation — jamais réécrit sur un renouvellement ou une réactivation
// ultérieure (voir /api/cron/referral-rewards, qui compte les filleuls
// devenus payants pendant UN mois donné, pas leur statut actuel).
async function isFirstTimeActive(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  matchValue: string,
  newStatus: string,
  matchColumn: 'id' | 'stripe_subscription_id' = 'id',
): Promise<boolean> {
  if (newStatus !== 'active') return false;
  const { data } = await supabaseAdmin
    .from('users')
    .select('became_paying_at')
    .eq(matchColumn, matchValue)
    .maybeSingle();
  return !data?.became_paying_at;
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
          const becamePayingNow = await isFirstTimeActive(supabaseAdmin, userId, newStatus);
          const { error, data } = await supabaseAdmin
            .from('users')
            .update({
              subscription_tier: tier,
              subscription_status: newStatus,
              stripe_subscription_id: subscription.id,
              trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
              ...(subscription.trial_end ? { trial_used: true } : {}),
              ...(becamePayingNow ? { became_paying_at: new Date().toISOString() } : {}),
            })
            .eq('id', userId)
            .select('id, referred_by');
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
        const becamePayingNow = await isFirstTimeActive(supabaseAdmin, subscription.id, newStatus, 'stripe_subscription_id');
        const { error, data } = await supabaseAdmin
          .from('users')
          .update({
            subscription_status: newStatus,
            trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
            ...(subscription.trial_end ? { trial_used: true } : {}),
            ...(becamePayingNow ? { became_paying_at: new Date().toISOString() } : {}),
          })
          .eq('stripe_subscription_id', subscription.id)
          .select('id');
        if (error) {
          console.error('[stripe-webhook] customer.subscription.updated: supabase update failed', JSON.stringify({ subscriptionId: subscription.id, error }));
        } else if (!data || data.length === 0) {
          console.error('[stripe-webhook] customer.subscription.updated: no user row matched', JSON.stringify({ subscriptionId: subscription.id }));
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
