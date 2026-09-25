import Stripe from 'npm:stripe@18.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

export function configuration() {
  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  const origin = Deno.env.get('APP_URL');
  const webhook = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret || !origin || !webhook) throw new Error('Pagamento ainda não configurado.');
  const url = new URL(origin);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') throw new Error('APP_URL deve usar HTTPS.');
  if (secret.startsWith('sk_live_') && Deno.env.get('ALLOW_LIVE_PAYMENTS') !== 'true') throw new Error('Pagamentos reais ainda não foram habilitados.');
  const stripe = new Stripe(secret, { httpClient: Stripe.createFetchHttpClient() });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  return { stripe, admin, origin: url.origin, webhook };
}

export const catalog = { basico: 3990, plus: 6990, pro: 9990 } as const;
export function selection(plan: unknown, cycle: unknown) {
  if (typeof plan !== 'string' || !Object.hasOwn(catalog, plan) || (cycle !== 'monthly' && cycle !== 'annual')) throw new Error('Plano ou periodicidade inválidos.');
  const price = Deno.env.get(`STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`);
  if (!price?.startsWith('price_')) throw new Error('Este plano ainda não está disponível para pagamento.');
  return { plan: plan as keyof typeof catalog, cycle, price, amount: catalog[plan as keyof typeof catalog] * (cycle === 'annual' ? 10 : 1) };
}

export function cors(origin: string) {
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
}
