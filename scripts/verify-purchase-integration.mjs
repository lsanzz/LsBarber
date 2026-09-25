import { spawn } from 'node:child_process';
import { chromium, expect } from '@playwright/test';

// Dedicated Vite process with fake config; every provider request is intercepted.
const origin = 'http://127.0.0.1:5181';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], {
  env: { ...process.env, VITE_BILLING_ENABLED: 'true', VITE_SUPABASE_URL: 'https://purchase-test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-public-key' },
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Vite did not start')), 20000);
    server.stdout.on('data', data => { if (String(data).includes('Local:')) { clearTimeout(timeout); resolve(); } });
    server.once('exit', code => { clearTimeout(timeout); reject(Error(`Vite exited: ${code}`)); });
  });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'teste@example.com', aud: 'authenticated', role: 'authenticated', email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: { business_name: 'Teste' } };
  const jwt = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test-signature`;
  let createCalls = 0;
  let statusCalls = 0;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': origin } });
    if (url.origin === origin || ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return route.continue();
    if (url.hostname === 'checkout.stripe.com') return route.fulfill({ body: '<h1>Checkout externo interceptado para teste</h1>', contentType: 'text/html' });
    if (url.hostname !== 'purchase-test.supabase.co') return route.abort();
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': origin, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.pathname.endsWith('/signup')) return json({ user, session: null });
    if (url.pathname.endsWith('/token')) return json({ access_token: jwt, token_type: 'bearer', expires_in: 3600, refresh_token: 'test-refresh', user });
    if (url.pathname.endsWith('/user')) return json(user);
    if (url.pathname.endsWith('/billing')) {
      const body = route.request().postDataJSON();
      if (body.action === 'create') {
        createCalls++;
        if (createCalls === 1) return json({ error: 'Pagamento temporariamente indisponível. Tente novamente.' }, 503);
        expect(body.plan).toBe('plus'); expect(body.cycle).toBe('annual');
        return json({ url: 'https://checkout.stripe.com/test-only' });
      }
      statusCalls++;
      return json({ paid: statusCalls > 1, plan: 'plus', cycle: 'annual' });
    }
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/cadastro?plano=plus&ciclo=annual');
  await page.getByLabel('Seu nome', { exact: true }).fill('Pessoa Teste');
  await page.getByLabel('Nome da barbearia').fill('Teste');
  await page.getByLabel('E-mail', { exact: true }).fill('teste@example.com');
  await page.getByLabel('Telefone com DDD').fill('11999990000');
  await page.getByLabel('Senha', { exact: true }).fill('SenhaTeste123');
  await page.getByLabel('Confirmar senha', { exact: true }).fill('SenhaTeste123');
  await page.getByRole('button', { name: 'Continuar para pagamento' }).click();
  await expect(page.getByRole('status')).toContainText('Confira seu e-mail');
  await page.getByLabel('Senha', { exact: true }).fill('SenhaTeste123');
  await page.getByRole('button', { name: 'Entrar e continuar' }).click();
  await expect(page).toHaveURL(/checkout\?plano=plus&ciclo=annual/);
  await page.getByRole('button', { name: 'Continuar para a Stripe' }).click();
  await expect(page.getByRole('alert')).toContainText('temporariamente indisponível');
  await page.getByRole('button', { name: 'Continuar para a Stripe' }).click();
  await expect(page).toHaveURL('https://checkout.stripe.com/test-only');
  await page.goto(origin + '/confirmacao?plano=plus&ciclo=annual&session_id=cs_test');
  await expect(page.getByRole('heading', { name: 'Aguardando confirmação.' })).toBeVisible();
  await page.getByRole('button', { name: 'Verificar novamente' }).click();
  await expect(page.getByRole('heading', { name: 'Pagamento confirmado.' })).toBeVisible();
  if (errors.length) throw Error(errors.join('\n'));
  console.log('PASS: integração simulada de cadastro, confirmação de e-mail, login, erro/retry Stripe, redirecionamento e confirmação consultada. Zero chamadas reais aos provedores.');
} finally { await browser?.close(); server.kill(); }
