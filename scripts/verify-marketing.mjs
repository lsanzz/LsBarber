import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const origin = process.env.CAPTURE_URL || 'http://localhost:5173';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir('artifacts/marketing', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/apresentacao');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Seu talento');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.sales-plan-price').first()).toContainText('39,90');
  await page.getByRole('button', { name: 'Anual 2 meses de economia' }).click();
  for (const [index, price] of ['399,00', '699,00', '999,00'].entries()) await expect(page.locator('.sales-plan-price').nth(index)).toContainText(price);
  await expect.poll(() => page.locator('.sales-plan-price .animated-digit > span').evaluateAll(elements => elements.every(element => getComputedStyle(element).transform === 'none'))).toBe(true);
  await page.locator('#planos').screenshot({ path: 'artifacts/marketing/pricing.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Mensal', exact: true }).click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: 'artifacts/marketing/desktop.png', fullPage: true, animations: 'disabled' });
  for (const name of ['Agenda', 'Caixa / PDV', 'Relatórios', 'Visão geral']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    const image = page.locator('.sales-showcase-image img');
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0 && img.currentSrc.endsWith('.webp'))).toBe(true);
  }
  await page.getByRole('button', { name: 'Ampliar tela de Visão geral' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByText('As telas mostram o sistema de verdade?', { exact: true }).click();
  await expect(page.getByText('Sim. As imagens foram capturadas', { exact: false })).toBeVisible();
  for (const width of [390, 768, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(origin + '/apresentacao');
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width === 390) {
      await page.getByRole('button', { name: 'Abrir menu' }).click();
      await page.getByRole('navigation').getByText('O sistema', { exact: true }).click();
      await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false');
      await page.goto(origin + '/apresentacao');
      await page.screenshot({ path: 'artifacts/marketing/mobile.png', fullPage: true, animations: 'disabled' });
    }
  }
  await page.getByRole('link', { name: 'Acessar sistema', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bem-vindo à LsBarber' })).toBeVisible();
  const state = await page.evaluate(() => localStorage.getItem('lsbarber-state-v1'));
  if (state && JSON.parse(state).clients.length) throw new Error('Dados demonstrativos vazaram para contexto limpo');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/apresentacao');
  await page.locator('.sales-resource-grid').evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
  await expect.poll(() => page.locator('.sales-resource').evaluateAll(elements => elements.some(el => el.getAnimations().length > 0))).toBe(true);
  await expect.poll(() => page.locator('.sales-scroll-progress').evaluate(el => parseFloat(getComputedStyle(el).transform.split('(')[1]))).toBeGreaterThan(0);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(origin + '/apresentacao');
  await expect.poll(() => page.locator('.sales-hero-preview').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.locator('#recursos').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
  const mobileImage = page.locator('.sales-hero-preview img');
  await expect.poll(() => mobileImage.evaluate(img => img.complete && img.currentSrc.includes('-480.webp'))).toBe(true);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS: desktop, mobile 320/390/768, galeria, imagens, modal/Escape, FAQ, menu, acesso ao painel e isolamento dos dados.');
} finally { await browser.close(); }
