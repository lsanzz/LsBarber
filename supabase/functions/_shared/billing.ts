import Stripe from 'npm:stripe@18.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

export function configuration() {
  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  const origin = Deno.env.get('APP_URL');
  const webhook = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret || !origin || !webhook) throw new Error('Pagamento ainda não configurado.');
  const url = new URL(origin);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') throw new Error('APP_URL deve usar HTTPS.');
  if (!secret.startsWith('sk_live_') && !secret.startsWith('sk_test_')) throw new Error('Chave Stripe inválida.');
  const livemode = secret.startsWith('sk_live_');
  if (livemode && Deno.env.get('ALLOW_LIVE_PAYMENTS') !== 'true') throw new Error('Pagamentos reais ainda não foram habilitados.');
  if (livemode && (url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('Pagamentos reais exigem um domínio público HTTPS.');
  }
  const stripe = new Stripe(secret, { httpClient: Stripe.createFetchHttpClient() });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  return { stripe, admin, origin: url.origin, webhook, livemode };
}

export const catalog = { basico: 3990, plus: 6990, pro: 9990 } as const;
export function selection(plan: unknown, cycle: unknown) {
  if (typeof plan !== 'string' || !Object.hasOwn(catalog, plan) || (cycle !== 'monthly' && cycle !== 'annual')) throw new Error('Plano ou periodicidade inválidos.');
  const price = Deno.env.get(`STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`);
  if (!price?.startsWith('price_')) throw new Error('Este plano ainda não está disponível para pagamento.');
  return { plan: plan as keyof typeof catalog, cycle, price, amount: catalog[plan as keyof typeof catalog] * (cycle === 'annual' ? 10 : 1) };
}

// Subscription metadata describes the original checkout, not later portal changes.
export function subscriptionSelection(subscription: Stripe.Subscription) {
  const items = subscription.items;
  if (items.has_more || items.data.length !== 1 || items.data[0].quantity !== 1) return null;
  const price = items.data[0].price;
  for (const plan of Object.keys(catalog) as (keyof typeof catalog)[]) {
    for (const cycle of ['monthly', 'annual'] as const) {
      const expected = Deno.env.get(`STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`);
      if (expected && price.id === expected && price.livemode === subscription.livemode
        && price.currency === 'brl' && price.unit_amount === catalog[plan] * (cycle === 'annual' ? 10 : 1)
        && price.recurring?.interval === (cycle === 'annual' ? 'year' : 'month')
        && price.recurring.interval_count === 1) return { plan, cycle };
    }
  }
  return null;
}

export function liveCheckoutAllowed(livemode: boolean, userId: string): boolean {
  if (!livemode) return true;
  const audience = Deno.env.get('LIVE_CHECKOUT_AUDIENCE');
  if (audience === 'public') return true;
  if (audience === 'restricted') return userId === Deno.env.get('LIVE_TEST_USER_ID');
  // A live key alone must never make checkout publicly available.
  return false;
}

export function cors(origin: string) {
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
}
