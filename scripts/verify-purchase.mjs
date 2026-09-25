import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const origin = process.env.CAPTURE_URL || 'http://localhost:5173';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir('artifacts/purchase', { recursive: true });
  await page.goto(origin + '/checkout?plano=pro&ciclo=annual');
  await expect(page.getByText('Preencha seu cadastro antes de testar o pagamento.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simular pagamento' })).toHaveCount(0);
  await page.goto(origin + '/confirmacao?plano=pro&ciclo=annual');
  await expect(page.getByRole('heading', { name: 'Vamos começar pelo cadastro.' })).toBeVisible();
  await page.goto(origin + '/apresentacao#planos');
  await page.getByRole('button', { name: 'Anual 2 meses de economia' }).click();
  await page.getByRole('link', { name: 'Escolher Plus', exact: true }).click();
  await expect(page).toHaveURL(/cadastro\?plano=plus&ciclo=annual/);
  await expect(page.locator('.purchase-summary')).toContainText('R$ 699,00');
  await page.getByLabel('Seu nome', { exact: true }).fill('Pessoa de teste');
  await page.getByLabel('Nome da barbearia').fill('Barbearia Demonstração');
  await page.getByLabel('E-mail', { exact: true }).fill('teste@example.com');
  await page.getByLabel('Telefone com DDD').fill('11999990000');
  await page.getByLabel('Senha de demonstração', { exact: true }).fill('SenhaFicticia123');
  await page.getByLabel('Confirmar senha', { exact: true }).fill('Diferente123');
  await page.getByRole('button', { name: 'Continuar para pagamento' }).click();
  await expect(page.getByRole('alert')).toContainText('As senhas precisam ser iguais');
  await page.getByLabel('Confirmar senha', { exact: true }).fill('SenhaFicticia123');
  await page.screenshot({ path: 'artifacts/purchase/cadastro-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Continuar para pagamento' }).click();
  await expect(page).toHaveURL(/checkout\?plano=plus&ciclo=annual/);
  await page.reload();
  await expect(page.getByText('Barbearia Demonstração', { exact: true })).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }));
  if (stored.includes('SenhaFicticia123')) throw Error('Senha armazenada no navegador');
  await page.getByLabel('Plano', { exact: true }).selectOption('pro');
  await expect(page.locator('.purchase-summary')).toContainText('R$ 999,00');
  await page.getByRole('button', { name: 'Mensal', exact: true }).click();
  await expect(page.locator('.purchase-summary')).toContainText('R$ 99,90');
  await page.screenshot({ path: 'artifacts/purchase/checkout-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Simular pagamento' }).click();
  await expect(page).toHaveURL(/confirmacao\?plano=pro&ciclo=monthly/);
  await expect(page.getByRole('heading', { name: 'Demonstração concluída!' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Demonstração concluída!' })).toBeVisible();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ['/cadastro?plano=pro&ciclo=annual', '/checkout?plano=pro&ciclo=annual', '/confirmacao?plano=pro&ciclo=monthly']) {
      await page.goto(origin + path);
      await expect(page.locator('h1')).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 390) await page.screenshot({ path: `artifacts/purchase/${path.split('?')[0].slice(1)}-mobile.png`, fullPage: true, animations: 'disabled' });
    }
  }
  await page.goto(origin + '/checkout?plano=basico&ciclo=monthly&cancelado=1');
  await expect(page.getByRole('status')).toContainText('Você voltou do checkout');
  await page.goto(origin + '/cadastro?plano=invalido&ciclo=errado');
  await expect(page.locator('.purchase-summary')).toContainText('PLANO PLUS');
  await expect(page.locator('.purchase-summary')).toContainText('R$ 69,90');
  if (errors.length) throw Error(errors.join('\n'));
  console.log('PASS: plano/ciclo, cadastro, validação, senha não persistida, revisão, refresh, simulação, confirmação, cancelamento, acesso direto e mobile.');
} finally { await browser.close(); }
