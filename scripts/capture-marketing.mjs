import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Contexto descartável: os dados abaixo nunca entram no navegador do usuário ou no banco.
const origin = process.env.CAPTURE_URL || 'http://localhost:5173';
const date = '2026-09-25';
const professionals = ['Lucas Martins', 'Rafael Costa', 'Bruno Alves'].map((name, i) => ({ id: `p${i}`, name, specialty: 'Barbeiro', attendance: 'masculino', commission: 40, color: ['#b8860b', '#6b8e9e', '#7a6f9b'][i], active: true }));
const services = [['Corte degradê', 50, 40], ['Barba completa', 35, 30], ['Corte + barba', 80, 60], ['Acabamento', 20, 15]].map(([name, price, duration], i) => ({ id: `s${i}`, name, price, duration, category: 'Barbearia', gender: 'masculino', commission: 40, active: true }));
const clients = ['Pedro Lima', 'André Santos', 'Gabriel Rocha', 'Felipe Souza', 'Diego Oliveira', 'Matheus Silva', 'João Mendes', 'Thiago Ribeiro', 'Henrique Dias'].map((name, i) => ({ id: `c${i}`, name, phone: '', gender: 'masculino', createdAt: `${date}T09:00:00-03:00` }));
const appointments = Array.from({ length: 15 }, (_, i) => ({ id: `a${i}`, clientId: `c${i % 9}`, professionalId: `p${i % 3}`, serviceId: `s${i % 3}`, start: `${date}T${String(9 + Math.floor(i / 3)).padStart(2, '0')}:00:00-03:00`, status: i < 3 ? 'finalizado' : i < 6 ? 'em_atendimento' : i % 2 ? 'confirmado' : 'agendado' }));
const products = [['Pomada matte', 12, 45], ['Óleo para barba', 3, 39], ['Shampoo masculino', 8, 55], ['Balm pós-barba', 2, 42]].map(([name, stock, price], i) => ({ id: `x${i}`, name, stock, price, cost: 20, minStock: 4, category: 'Cuidados', active: true }));
const sales = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, clientId: `c${i % 9}`, items: [{ kind: 'service', refId: `s${i % 3}`, name: services[i % 3].name, price: services[i % 3].price, quantity: 1, professionalId: `p${i % 3}`, commissionPct: 40 }], discount: 0, total: services[i % 3].price, paymentMethod: ['pix', 'dinheiro', 'debito', 'credito'][i % 4], createdAt: `${date}T09:00:00-03:00` }));
const state = { settings: { name: 'LsBarber', phone: '', whatsapp: '', email: '', address: '', openHour: 9, closeHour: 20, workDays: [1, 2, 3, 4, 5, 6] }, professionals, services, clients, appointments, products, sales };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === new URL(origin).origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' ? route.continue() : route.abort();
  });
  await context.addInitScript(data => localStorage.setItem('lsbarber-state-v1', JSON.stringify(data)), state);
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(`${date}T10:30:00-03:00`));
  await mkdir('public/images', { recursive: true });
  for (const [name, path] of [['dashboard', '/'], ['agenda', '/agenda'], ['caixa', '/caixa'], ['relatorios', '/relatorios']]) {
    await page.goto(origin + path);
    await page.locator('main h1').waitFor();
    await page.evaluate(() => document.fonts.ready);
    // Oculta apenas o indicador técnico na captura, sem alterar o painel real.
    const localBadge = page.locator('header').getByText('Modo local', { exact: true });
    await localBadge.evaluate(element => { element.style.visibility = 'hidden'; });
    if (name === 'caixa') {
      await page.locator('select').nth(3).selectOption('s2');
      await page.locator('select').nth(4).selectOption('x0');
      await page.getByLabel('Cliente (opcional)').selectOption('c0');
    }
    await page.screenshot({ path: `public/images/${name}.jpg`, type: 'jpeg', quality: 90 });
  }
} finally { await browser.close(); }
