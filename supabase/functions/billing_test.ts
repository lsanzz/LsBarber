import { strict as assert } from 'node:assert';
import Stripe from 'npm:stripe@18.5.0';
import { configuration, liveCheckoutAllowed } from './_shared/billing.ts';
import { handleBilling } from './billing/handler.ts';
import { handleWebhook } from './stripe-webhook/handler.ts';

// All HTTP calls are intercepted. No external account, customer or charge is created.
const userId = '00000000-0000-4000-8000-000000000001';
const env = { APP_URL: 'http://localhost:5173', SUPABASE_URL: 'https://billing-test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', STRIPE_SECRET_KEY: 'sk_test_example', STRIPE_WEBHOOK_SECRET: 'whsec_example', STRIPE_PRICE_PLUS_ANNUAL: 'price_plus_annual', STRIPE_PRICE_BASICO_MONTHLY: 'price_basico_monthly', STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly' };
for (const [key, value] of Object.entries(env)) Deno.env.set(key, value);
type Options = { wrongPrice?: boolean; wrongModePrice?: boolean; wrongEnvironment?: boolean; wrongOwner?: boolean; active?: boolean; paginatedActive?: boolean; locked?: boolean; failSave?: boolean; unpaid?: boolean; existing?: boolean; paginatedOpen?: boolean; unconfirmed?: boolean; noCustomer?: boolean; savedSubscription?: boolean; inactiveSubscription?: boolean; wrongSubscription?: boolean; portalPlanChange?: boolean; unknownSubscriptionPrice?: boolean; extraSubscriptionItem?: boolean };
async function withMock(options: Options, callback: (requests: { path: string; query: string; body: string }[]) => Promise<void>) {
  const original = globalThis.fetch;
  const requests: { path: string; query: string; body: string }[] = [];
  let customerSaved = false;
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const path = url.pathname;
    const body = req.method === 'GET' ? '' : await req.text();
    requests.push({ path, query: url.search, body });
    const json = (data: unknown, status = 200) => Response.json(data, { status });
    if (path === '/auth/v1/user') return json({ id: userId, email: 'test@example.com', email_confirmed_at: options.unconfirmed ? null : '2026-01-01', user_metadata: { business_name: 'Test business' } });
    if (path === '/rest/v1/billing_environment') return json({ live_mode: !!options.wrongEnvironment });
    if (path === '/rest/v1/rpc/acquire_billing_lock') return json(!options.locked);
    if (path === '/rest/v1/billing_checkout_locks') return new Response(null, { status: 204 });
    if (path === '/rest/v1/billing_customers') {
      if (req.method === 'POST') { customerSaved = true; return json({}); }
      return json(options.noCustomer && !customerSaved ? null : { user_id: userId, livemode: false, stripe_customer_id: customerSaved ? 'cus_new' : 'cus_test' });
    }
    if (path === '/rest/v1/billing_subscriptions') return json(options.savedSubscription
      ? { stripe_subscription_id: options.wrongSubscription ? 'sub_other' : 'sub_test', status: options.inactiveSubscription ? 'past_due' : 'active' }
      : null);
    if (path === '/rest/v1/rpc/save_billing_subscription') return options.failSave ? json({ message: 'test database failure' }, 500) : new Response(null, { status: 204 });
    if (path === '/v1/prices/price_plus_annual') return json({ id: 'price_plus_annual', active: true, livemode: !!options.wrongModePrice, currency: 'brl', unit_amount: options.wrongPrice ? 1 : 69900, recurring: { interval: 'year', interval_count: 1 } });
    if (path === '/v1/customers' && req.method === 'POST') return json({ id: 'cus_new', livemode: false });
    if (path === '/v1/subscriptions') {
      if (options.paginatedActive) return url.searchParams.has('starting_after')
        ? json({ object: 'list', data: [{ id: 'sub_active', status: 'active' }], has_more: false })
        : json({ object: 'list', data: Array.from({ length: 100 }, (_, i) => ({ id: `sub_old_${i}`, status: 'canceled' })), has_more: true });
      return json({ object: 'list', data: options.active ? [{ id: 'sub_test', status: 'active' }] : [], has_more: false });
    }
    if (path === '/v1/checkout/sessions' && req.method === 'GET') {
      if (options.paginatedOpen) return url.searchParams.has('starting_after')
        ? json({ object: 'list', data: [{ id: 'cs_existing', url: 'https://checkout.stripe.com/existing', metadata: { plan: 'plus', cycle: 'annual' } }], has_more: false })
        : json({ object: 'list', data: Array.from({ length: 100 }, (_, i) => ({ id: `cs_old_${i}`, metadata: { plan: 'basico', cycle: 'monthly' } })), has_more: true });
      return json({ object: 'list', data: options.existing ? [{ id: 'cs_existing', url: 'https://checkout.stripe.com/existing', metadata: { plan: 'plus', cycle: 'annual' } }] : [], has_more: false });
    }
    if (path === '/v1/checkout/sessions' && req.method === 'POST') return json({ id: 'cs_test', status: 'open', url: 'https://checkout.stripe.com/test' });
    if (path === '/v1/checkout/sessions/cs_test') return json({ id: 'cs_test', status: 'complete', payment_status: options.unpaid ? 'unpaid' : 'paid', subscription: 'sub_test', client_reference_id: options.wrongOwner ? 'someone-else' : userId, metadata: { plan: 'plus', cycle: 'annual' } });
    if (path === '/v1/subscriptions/sub_test') {
      const price = options.unknownSubscriptionPrice ? 'price_unknown' : options.portalPlanChange ? 'price_pro_monthly' : 'price_plus_annual';
      const priceData = { id: price, livemode: false, currency: 'brl', unit_amount: options.portalPlanChange ? 9990 : 69900, recurring: { interval: options.portalPlanChange ? 'month' : 'year', interval_count: 1 } };
      return json({ id: 'sub_test', customer: 'cus_test', livemode: false, status: 'active', metadata: { plan: 'plus', cycle: 'annual' }, cancel_at_period_end: false,
        items: { has_more: false, data: [{ quantity: 1, price: priceData }, ...(options.extraSubscriptionItem ? [{ quantity: 1, price: priceData }] : [])] } });
    }
    if (path === '/v1/billing_portal/sessions') return json({ url: 'https://billing.stripe.com/p/session/test_example' });
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
  for (const options of [{ wrongPrice: true }, { wrongModePrice: true }, { active: true }, { locked: true }]) await withMock(options, async requests => {
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
Deno.test('confirmation requires both Stripe payment and active workspace entitlement', async () => {
  await withMock({ wrongOwner: true }, async () => assert.equal((await handleBilling(request({ action: 'status', sessionId: 'cs_test' }))).status, 404));
  await withMock({ unpaid: true }, async () => {
    const result = await (await handleBilling(request({ action: 'status', sessionId: 'cs_test' }))).json();
    assert.equal(result.paid, false);
    assert.equal(result.accessReady, false);
  });
  for (const options of [{}, { savedSubscription: true, inactiveSubscription: true }, { savedSubscription: true, wrongSubscription: true }]) {
    await withMock(options, async () => {
      const result = await (await handleBilling(request({ action: 'status', sessionId: 'cs_test' }))).json();
      assert.equal(result.paid, true);
      assert.equal(result.accessReady, false);
    });
  }
  await withMock({ savedSubscription: true }, async requests => {
    const result = await (await handleBilling(request({ action: 'status', sessionId: 'cs_test' }))).json();
    assert.equal(result.accessReady, true);
    const read = requests.find(row => row.path === '/rest/v1/billing_subscriptions')!;
    assert.ok(read.query.includes('user_id=eq.'));
    assert.ok(read.query.includes('livemode=eq.false'));
  });
});
Deno.test('checkout scans later Stripe pages before reusing or creating a payment', async () => {
  await withMock({ paginatedActive: true }, async requests => {
    assert.equal((await handleBilling(request({ action: 'create', plan: 'plus', cycle: 'annual' }))).status, 409);
    assert.ok(requests.some(row => row.path === '/v1/subscriptions' && row.query.includes('starting_after=')));
    assert.ok(!requests.some(row => row.path === '/v1/checkout/sessions'));
  });
  await withMock({ paginatedOpen: true }, async requests => {
    const response = await handleBilling(request({ action: 'create', plan: 'plus', cycle: 'annual' }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).url, 'https://checkout.stripe.com/existing');
    assert.ok(requests.some(row => row.path === '/v1/checkout/sessions' && row.query.includes('starting_after=')));
    assert.ok(!requests.some(row => row.path === '/v1/checkout/sessions' && row.body));
  });
});
Deno.test('billing mode mismatch blocks checkout before Stripe calls', async () => {
  await withMock({ wrongEnvironment: true }, async requests => {
    assert.equal((await handleBilling(request({ action: 'create', plan: 'plus', cycle: 'annual' }))).status, 503);
    assert.ok(!requests.some(row => row.path.startsWith('/v1/')));
  });
});
Deno.test('customer records are scoped to test or live Stripe mode', async () => {
  await withMock({ noCustomer: true }, async requests => {
    assert.equal((await handleBilling(request({ action: 'create', plan: 'plus', cycle: 'annual' }))).status, 200);
    const reads = requests.filter(row => row.path === '/rest/v1/billing_customers' && !row.body);
    assert.ok(reads.every(row => row.query.includes('livemode=eq.false')));
    const created = JSON.parse(requests.find(row => row.path === '/rest/v1/billing_customers' && row.body)!.body);
    assert.equal(created.livemode, false);
  });
});
Deno.test('live payments require explicit approval and a public HTTPS origin', () => {
  const previous = {
    key: Deno.env.get('STRIPE_SECRET_KEY'),
    allow: Deno.env.get('ALLOW_LIVE_PAYMENTS'),
    origin: Deno.env.get('APP_URL'),
  };
  try {
    Deno.env.set('STRIPE_SECRET_KEY', 'sk_live_example');
    Deno.env.set('ALLOW_LIVE_PAYMENTS', 'false');
    assert.throws(() => configuration(), /não foram habilitados/);
    Deno.env.set('ALLOW_LIVE_PAYMENTS', 'true');
    assert.throws(() => configuration(), /domínio público HTTPS/);
    Deno.env.set('APP_URL', 'https://lsbarber.example');
    assert.doesNotThrow(() => configuration());
  } finally {
    for (const [key, value] of Object.entries({ STRIPE_SECRET_KEY: previous.key, ALLOW_LIVE_PAYMENTS: previous.allow, APP_URL: previous.origin })) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
});
Deno.test('live checkout stays private until its audience is explicitly opened', async () => {
  const previous = {
    key: Deno.env.get('STRIPE_SECRET_KEY'), origin: Deno.env.get('APP_URL'),
    allow: Deno.env.get('ALLOW_LIVE_PAYMENTS'), audience: Deno.env.get('LIVE_CHECKOUT_AUDIENCE'),
    tester: Deno.env.get('LIVE_TEST_USER_ID'),
  };
  try {
    Deno.env.set('STRIPE_SECRET_KEY', 'sk_live_example');
    Deno.env.set('APP_URL', 'https://lsbarber.example');
    Deno.env.set('ALLOW_LIVE_PAYMENTS', 'true');
    Deno.env.delete('LIVE_CHECKOUT_AUDIENCE');
    assert.equal(liveCheckoutAllowed(true, userId), false);
    const liveRequest = new Request('https://lsbarber.example/billing', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer fake-test-token' },
      body: JSON.stringify({ action: 'create', plan: 'plus', cycle: 'annual' }),
    });
    await withMock({ wrongEnvironment: true }, async requests => {
      assert.equal((await handleBilling(liveRequest)).status, 403);
      assert.ok(!requests.some(row => row.path.startsWith('/v1/')));
    });
    Deno.env.set('LIVE_CHECKOUT_AUDIENCE', 'restricted');
    Deno.env.set('LIVE_TEST_USER_ID', '00000000-0000-4000-8000-000000000099');
    assert.equal(liveCheckoutAllowed(true, userId), false);
    Deno.env.set('LIVE_TEST_USER_ID', userId);
    assert.equal(liveCheckoutAllowed(true, userId), true);
    Deno.env.set('LIVE_CHECKOUT_AUDIENCE', 'public');
    assert.equal(liveCheckoutAllowed(true, 'another-user'), true);
    assert.equal(liveCheckoutAllowed(false, 'another-user'), true);
  } finally {
    for (const [key, value] of Object.entries({ STRIPE_SECRET_KEY: previous.key, APP_URL: previous.origin,
      ALLOW_LIVE_PAYMENTS: previous.allow, LIVE_CHECKOUT_AUDIENCE: previous.audience, LIVE_TEST_USER_ID: previous.tester })) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
});
Deno.test('billing portal is available only for the authenticated owner customer', async () => {
  await withMock({ noCustomer: true }, async requests => {
    assert.equal((await handleBilling(request({ action: 'portal' }))).status, 404);
    assert.ok(!requests.some(row => row.path === '/v1/billing_portal/sessions'));
  });
  await withMock({}, async requests => {
    const response = await handleBilling(request({ action: 'portal' }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).url, 'https://billing.stripe.com/p/session/test_example');
    const payload = new URLSearchParams(requests.find(row => row.path === '/v1/billing_portal/sessions')!.body);
    assert.equal(payload.get('customer'), 'cus_test');
    assert.equal(payload.get('return_url'), 'http://localhost:5173/assinatura');
  });
});
Deno.test('webhook rejects unsigned payloads', async () => {
  assert.equal((await handleWebhook(new Request('http://localhost/webhook', { method: 'POST', body: '{}' }))).status, 400);
  assert.equal((await handleWebhook(new Request('http://localhost/webhook', { method: 'POST', headers: { 'stripe-signature': 'fake' }, body: '{}' }))).status, 400);
});
Deno.test('webhook rejects a signed event from the wrong Stripe mode', async () => {
  const stripe = new Stripe('sk_test_example');
  const payload = JSON.stringify({ id: 'evt_wrong_mode', type: 'customer.subscription.updated', livemode: true, created: 1790358763, data: { object: { id: 'sub_test' } } });
  const signature = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret: env.STRIPE_WEBHOOK_SECRET, cryptoProvider: Stripe.createSubtleCryptoProvider() });
  await withMock({}, async requests => {
    const response = await handleWebhook(new Request('http://localhost/webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': signature } }));
    assert.equal(response.status, 400);
    assert.ok(!requests.some(row => row.path.endsWith('/save_billing_subscription')));
  });
});
Deno.test('signed webhook persists current status and returns failure for retry on database errors', async () => {
  const stripe = new Stripe('sk_test_example');
  const payload = JSON.stringify({ id: 'evt_test', type: 'customer.subscription.updated', livemode: false, created: 1790358763, data: { object: { id: 'sub_test' } } });
  const signature = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret: env.STRIPE_WEBHOOK_SECRET, cryptoProvider: Stripe.createSubtleCryptoProvider() });
  for (const failSave of [false, true]) await withMock({ failSave }, async requests => {
    const response = await handleWebhook(new Request('http://localhost/webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': signature } }));
    assert.equal(response.status, failSave ? 500 : 200);
    const write = JSON.parse(requests.find(row => row.path.endsWith('/save_billing_subscription'))!.body);
    assert.equal(write.p_user, userId);
    assert.equal(write.p_livemode, false);
    assert.equal(write.p_status, 'active');
    assert.equal(write.p_plan, 'plus');
    assert.equal(write.p_cycle, 'annual');
  });
});
Deno.test('webhook follows the current Stripe price after a portal plan change', async () => {
  const stripe = new Stripe('sk_test_example');
  const payload = JSON.stringify({ id: 'evt_portal_change', type: 'customer.subscription.updated', livemode: false, created: 1790358764, data: { object: { id: 'sub_test' } } });
  const signature = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret: env.STRIPE_WEBHOOK_SECRET, cryptoProvider: Stripe.createSubtleCryptoProvider() });
  await withMock({ portalPlanChange: true }, async requests => {
    assert.equal((await handleWebhook(new Request('http://localhost/webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': signature } }))).status, 200);
    const write = JSON.parse(requests.find(row => row.path.endsWith('/save_billing_subscription'))!.body);
    assert.equal(write.p_plan, 'pro');
    assert.equal(write.p_cycle, 'monthly');
  });
  for (const options of [{ unknownSubscriptionPrice: true }, { extraSubscriptionItem: true }]) {
    await withMock(options, async requests => {
      assert.equal((await handleWebhook(new Request('http://localhost/webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': signature } }))).status, 200);
      const write = JSON.parse(requests.find(row => row.path.endsWith('/save_billing_subscription'))!.body);
      assert.equal(write.p_status, 'unrecognized_price');
    });
  }
});
