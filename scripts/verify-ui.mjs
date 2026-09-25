import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:5173/');
  await page.getByRole('navigation', { name: 'Menu do sistema' }).getByRole('link', { name: 'Clientes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Clientes', exact: true })).toBeVisible();
  const add = page.getByRole('button', { name: /Novo cliente/i });
  await add.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  await mkdir('artifacts/marketing', { recursive: true });
  await page.screenshot({ path: 'artifacts/marketing/app-dialog.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(add).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await add.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Fechar janela' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  if (errors.length) throw Error(errors.join('\n'));
  console.log('PASS: navegação do painel, modal desktop/mobile, foco contido, Escape, retorno do foco e fechamento.');
} finally { await browser.close(); }
