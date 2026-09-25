import { configuration, cors, selection } from '../_shared/billing.ts';

export async function handleBilling(request: Request): Promise<Response> {
  const origin = Deno.env.get('APP_URL') ? new URL(Deno.env.get('APP_URL')!).origin : 'http://localhost:5173';
  const headers = cors(origin);
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
  if (request.headers.get('origin') && request.headers.get('origin') !== origin) return json({ error: 'Origem inválida.' }, 403);
  let releaseLock: (() => Promise<void>) | undefined;
  try {
    const { stripe, admin } = configuration();
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Entre na sua conta para continuar.' }, 401);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user?.email || !user.email_confirmed_at) return json({ error: 'Entre na sua conta e confirme seu e-mail.' }, 401);
    const body = await request.json();

    if (body.action === 'status') {
      if (typeof body.sessionId !== 'string' || !body.sessionId.startsWith('cs_')) return json({ error: 'Sessão inválida.' }, 400);
      const session = await stripe.checkout.sessions.retrieve(body.sessionId);
      if (session.client_reference_id !== user.id) return json({ error: 'Sessão não encontrada nesta conta.' }, 404);
      return json({ paid: session.status === 'complete' && session.payment_status === 'paid', plan: session.metadata?.plan, cycle: session.metadata?.cycle });
    }
    if (body.action !== 'create') return json({ error: 'Operação inválida.' }, 400);
    const chosen = selection(body.plan, body.cycle);
    const lockToken = crypto.randomUUID();
    const { data: acquired, error: lockError } = await admin.rpc('acquire_billing_lock', { p_user: user.id, p_token: lockToken });
    if (lockError) throw lockError;
    if (!acquired) return json({ error: 'Já estamos preparando seu pagamento. Aguarde alguns instantes e tente novamente.' }, 409);
    releaseLock = async () => { await admin.from('billing_checkout_locks').delete().eq('user_id', user.id).eq('token', lockToken); };
    // Never accept amounts or Price IDs from the browser; also catch incorrect dashboard configuration.
    const price = await stripe.prices.retrieve(chosen.price);
    if (!price.active || price.currency !== 'brl' || price.unit_amount !== chosen.amount || price.recurring?.interval !== (chosen.cycle === 'annual' ? 'year' : 'month') || price.recurring.interval_count !== 1) return json({ error: 'Configuração de preço inconsistente. Contate o responsável pela LsBarber.' }, 503);
    const { data: account, error: accountError } = await admin.from('billing_customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
    if (accountError) throw accountError;
    let customerId = account?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.user_metadata.business_name || user.user_metadata.full_name || user.email, metadata: { user_id: user.id } }, { idempotencyKey: `lsbarber-customer-${user.id}` });
      const { error } = await admin.from('billing_customers').upsert({ user_id: user.id, stripe_customer_id: customer.id }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (error) throw error;
      const { data: saved, error: readError } = await admin.from('billing_customers').select('stripe_customer_id').eq('user_id', user.id).single();
      if (readError) throw readError;
      customerId = saved.stripe_customer_id;
    }
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
    if (subscriptions.data.some(sub => ['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete'].includes(sub.status))) return json({ error: 'Esta conta já possui uma assinatura ou pagamento em andamento. Não criaremos uma cobrança duplicada.' }, 409);
    const open = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 });
    const existing = open.data.find(session => session.metadata?.plan === chosen.plan && session.metadata?.cycle === chosen.cycle);
    if (existing?.url) return json({ url: existing.url });
    // Avoid keeping an old payment link valid after the customer changes plans.
    for (const session of open.data) await stripe.checkout.sessions.expire(session.id);
    const metadata = { user_id: user.id, plan: chosen.plan, cycle: chosen.cycle };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', customer: customerId, client_reference_id: user.id,
      line_items: [{ price: chosen.price, quantity: 1 }], payment_method_types: ['card'],
      metadata, subscription_data: { metadata }, locale: 'pt-BR',
      success_url: `${origin}/confirmacao?plano=${chosen.plan}&ciclo=${chosen.cycle}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?plano=${chosen.plan}&ciclo=${chosen.cycle}&cancelado=1`,
    }, { idempotencyKey: `checkout-${user.id}-${chosen.plan}-${chosen.cycle}-${Math.floor(Date.now() / 60000)}` });
    if (!session.url || session.status !== 'open') return json({ error: 'A sessão anterior expirou. Aguarde um minuto e tente novamente.' }, 409);
    return json({ url: session.url });
  } catch (error) {
    console.error('Billing request failed', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'Não foi possível preparar o pagamento. Confira a configuração e tente novamente.' }, 503);
  } finally {
    if (releaseLock) await releaseLock();
  }
}
