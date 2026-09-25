import sharp from 'sharp';
import { stat } from 'node:fs/promises';

for (const name of ['dashboard', 'agenda', 'caixa', 'relatorios']) {
  const input = `public/images/${name}.jpg`;
  for (const width of [480, 800, 1200, 1440]) {
    await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 82, effort: 6 }).toFile(`public/images/${name}-${width}.webp`);
  }
  const original = (await stat(input)).size;
  const optimized = (await stat(`public/images/${name}-1440.webp`)).size;
  console.log(`${name}: ${original} → ${optimized} bytes (${Math.round((1 - optimized / original) * 100)}% menor)`);
}
