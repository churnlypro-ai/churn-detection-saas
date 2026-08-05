import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';

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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        const tier = session.metadata?.tier;
        if (userId && tier) {
          await supabaseAdmin
            .from('users')
            .update({
              subscription_tier: tier,
              subscription_status: 'active',
              stripe_subscription_id: session.subscription,
            })
            .eq('id', userId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await supabaseAdmin
          .from('users')
          .update({
            subscription_status: subscription.status === 'active' ? 'active' : 'past_due',
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await supabaseAdmin
          .from('users')
          .update({ subscription_status: 'canceled', subscription_tier: null })
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
