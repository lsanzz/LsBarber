import { strict as assert } from 'node:assert';
import Stripe from 'npm:stripe@18.5.0';
import { handleBilling } from './billing/handler.ts';
import { handleWebhook } from './stripe-webhook/handler.ts';

// All HTTP calls are intercepted. No external account, customer or charge is created.
const userId = '00000000-0000-4000-8000-000000000001';
const env = { APP_URL: 'http://localhost:5173', SUPABASE_URL: 'https://billing-test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', STRIPE_SECRET_KEY: 'sk_test_example', STRIPE_WEBHOOK_SECRET: 'whsec_example', STRIPE_PRICE_PLUS_ANNUAL: 'price_plus_annual', STRIPE_PRICE_BASICO_MONTHLY: 'price_basico_monthly' };
for (const [key, value] of Object.entries(env)) Deno.env.set(key, value);
type Options = { wrongPrice?: boolean; wrongOwner?: boolean; active?: boolean; locked?: boolean; failSave?: boolean; unpaid?: boolean; existing?: boolean; unconfirmed?: boolean };
async function withMock(options: Options, callback: (requests: { path: string; body: string }[]) => Promise<void>) {
  const original = globalThis.fetch;
  const requests: { path: string; body: string }[] = [];
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const path = url.pathname;
    const body = req.method === 'GET' ? '' : await req.text();
    requests.push({ path, body });
    const json = (data: unknown, status = 200) => Response.json(data, { status });
    if (path === '/auth/v1/user') return json({ id: userId, email: 'test@example.com', email_confirmed_at: options.unconfirmed ? null : '2026-01-01', user_metadata: { business_name: 'Test business' } });
    if (path === '/rest/v1/rpc/acquire_billing_lock') return json(!options.locked);
    if (path === '/rest/v1/billing_checkout_locks') return new Response(null, { status: 204 });
    if (path === '/rest/v1/billing_customers') return json({ user_id: userId, stripe_customer_id: 'cus_test' });
    if (path === '/rest/v1/rpc/save_billing_subscription') return options.failSave ? json({ message: 'test database failure' }, 500) : new Response(null, { status: 204 });
    if (path === '/v1/prices/price_plus_annual') return json({ id: 'price_plus_annual', active: true, currency: 'brl', unit_amount: options.wrongPrice ? 1 : 69900, recurring: { interval: 'year', interval_count: 1 } });
    if (path === '/v1/subscriptions') return json({ data: options.active ? [{ id: 'sub_test', status: 'active' }] : [] });
    if (path === '/v1/checkout/sessions' && req.method === 'GET') return json({ data: options.existing ? [{ id: 'cs_existing', url: 'https://checkout.stripe.com/existing', metadata: { plan: 'plus', cycle: 'annual' } }] : [] });
    if (path === '/v1/checkout/sessions' && req.method === 'POST') return json({ id: 'cs_test', status: 'open', url: 'https://checkout.stripe.com/test' });
    if (path === '/v1/checkout/sessions/cs_test') return json({ id: 'cs_test', status: 'complete', payment_status: options.unpaid ? 'unpaid' : 'paid', client_reference_id: options.wrongOwner ? 'someone-else' : userId, metadata: { plan: 'plus', cycle: 'annual' } });
    if (path === '/v1/subscriptions/sub_test') return json({ id: 'sub_test', customer: 'cus_test', status: 'active', metadata: { plan: 'plus', cycle: 'annual' }, cancel_at_period_end: false });
    throw new Error(`Unexpected outbound request blocked: ${url.host}${path}`);
  };
  try { await callback(requests); } finally { globalThis.fetch = original; }
}
const request = (body: object, auth = true) => new Request('http://localhost/billing', { method: 'POST', headers: { 'content-type': 'application/json', origin: env.APP_URL, ...(auth ? { authorization: 'Bearer fake-test-token' } : {}) }, body: JSON.stringify(body) });

Deno.test('billing rejects missing authentication and unconfirmed email', async () => {
  await withMock({}, async requests => { assert.equal((await handleBilling(request({ action: 'create' }, false))).status, 401); assert.equal(requests.length, 0); });
  await withMock({ unconfirmed: true }, async () => { assert.equal((await handleBilling(request({ action: 'create' }))).status, 401); });
});
Deno.test('server chooses price, ignores forged amount and sets subscription metadata', async () => {
  await withMock({}, async requests => {
    const result = await handleBilling(request({ action: 'create', plan: 'plus', cycle: 'annual', amount: 1, price: 'price_attack' }));
    assert.equal(result.status, 200);
    const created = requests.find(row => row.path === '/v1/checkout/sessions' && row.body)!;
    const data = new URLSearchParams(created.body);
    assert.equal(data.get('line_items[0][price]'), 'price_plus_annual');
    assert.equal(data.get('mode'), 'subscription');
    assert.equal(data.get('subscription_data[metadata][user_id]'), userId);
    assert.match(data.get('success_url')!, /session_id=\{CHECKOUT_SESSION_ID\}/);
    assert.match(data.get('cancel_url')!, /cancelado=1/);
  });
});
Deno.test('misconfigured amount, active subscription and concurrency lock prevent checkout', async () => {
  for (const options of [{ wrongPrice: true }, { active: true }, { locked: true }]) await withMock(options, async requests => {
    assert.ok((await handleBilling(request({ action: 'create', plan: 'plus', cycle: 'annual' }))).status >= 400);
    assert.ok(!requests.some(row => row.path === '/v1/checkout/sessions' && row.body));
  });
});
Deno.test('open checkout is reused', async () => {
  await withMock({ existing: true }, async requests => {
    const data = await (await handleBilling(request({ action: 'create', plan: 'plus', cycle: 'annual' }))).json();
    assert.equal(data.url, 'https://checkout.stripe.com/existing');
    assert.ok(!requests.some(row => row.path === '/v1/checkout/sessions' && row.body));
  });
});
Deno.test('confirmation checks owner and paid status on Stripe', async () => {
  await withMock({ wrongOwner: true }, async () => assert.equal((await handleBilling(request({ action: 'status', sessionId: 'cs_test' }))).status, 404));
  await withMock({ unpaid: true }, async () => assert.equal((await (await handleBilling(request({ action: 'status', sessionId: 'cs_test' }))).json()).paid, false));
  await withMock({}, async () => assert.equal((await (await handleBilling(request({ action: 'status', sessionId: 'cs_test' }))).json()).paid, true));
});
Deno.test('webhook rejects unsigned payloads', async () => {
  assert.equal((await handleWebhook(new Request('http://localhost/webhook', { method: 'POST', body: '{}' }))).status, 400);
  assert.equal((await handleWebhook(new Request('http://localhost/webhook', { method: 'POST', headers: { 'stripe-signature': 'fake' }, body: '{}' }))).status, 400);
});
Deno.test('signed webhook persists current status and returns failure for retry on database errors', async () => {
  const stripe = new Stripe('sk_test_example');
  const payload = JSON.stringify({ id: 'evt_test', type: 'customer.subscription.updated', created: 1790358763, data: { object: { id: 'sub_test' } } });
  const signature = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret: env.STRIPE_WEBHOOK_SECRET, cryptoProvider: Stripe.createSubtleCryptoProvider() });
  for (const failSave of [false, true]) await withMock({ failSave }, async requests => {
    const response = await handleWebhook(new Request('http://localhost/webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': signature } }));
    assert.equal(response.status, failSave ? 500 : 200);
    const write = JSON.parse(requests.find(row => row.path.endsWith('/save_billing_subscription'))!.body);
    assert.equal(write.p_user, userId);
    assert.equal(write.p_status, 'active');
  });
});
