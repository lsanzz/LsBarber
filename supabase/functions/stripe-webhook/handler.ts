import Stripe from 'npm:stripe@18.5.0';
import { configuration } from '../_shared/billing.ts';

export async function handleWebhook(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const { stripe, admin, webhook } = configuration();
    const signature = request.headers.get('stripe-signature');
    if (!signature) return new Response('Missing signature', { status: 400 });
    let event: Stripe.Event;
    try { event = await stripe.webhooks.constructEventAsync(await request.text(), signature, webhook, undefined, Stripe.createSubtleCryptoProvider()); }
    catch { return new Response('Invalid signature', { status: 400 }); }
    let subscriptionId: string | undefined;
    if (event.type.startsWith('customer.subscription.')) subscriptionId = (event.data.object as Stripe.Subscription).id;
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const subscription = (event.data.object as Stripe.Checkout.Session).subscription;
      subscriptionId = typeof subscription === 'string' ? subscription : subscription?.id;
    }
    if (!subscriptionId) return Response.json({ received: true });
    // Fetch the current subscription, rather than trust potentially out-of-order event payloads.
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const { data: customer, error } = await admin.from('billing_customers').select('user_id').eq('stripe_customer_id', customerId).single();
    if (error) throw error;
    const { error: saveError } = await admin.rpc('save_billing_subscription', {
      p_id: subscription.id, p_user: customer.user_id, p_status: subscription.status,
      p_plan: subscription.metadata.plan, p_cycle: subscription.metadata.cycle,
      p_event_time: event.created, p_cancel_at_end: subscription.cancel_at_period_end,
    });
    if (saveError) throw saveError;
    return Response.json({ received: true });
  } catch { return new Response('Unable to persist event; retry required', { status: 500 }); }
}
