/**
 * Generate PWA icon PNGs from web/public/logo-source.png
 * Run once after updating the source logo:  node scripts/gen-icons.mjs
 * Commit the generated PNGs alongside the source.
 *
 * What it does:
 *  1. Trims all white/near-white border from the source image.
 *  2. Places the trimmed logo centred on a white square canvas
 *     with 12 % padding on each side.
 *  3. Exports icon-192.png, icon-512.png, apple-touch-icon.png.
 */

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../web/public/logo-source.png');
const OUT = path.resolve(__dirname, '../web/public');

const PADDING_PCT = 0.06;  // 6 % breathing room around the logo
// Deep navy/dark-blue background — matches the app's primary accent palette
// and makes the blue/cyan logo pop on the icon.
const BG = { r: 4, g: 12, b: 36, alpha: 1 };

const SIZES = [
  { file: 'icon-192.png',         px: 192 },
  { file: 'icon-512.png',         px: 512 },
  { file: 'apple-touch-icon.png', px: 180 },
];

// ── 1. Trim white space and re-encode as PNG so sharp can process it reliably ─
const trimmedPng = await sharp(SRC)
  .trim({ background: '#ffffff', threshold: 30 })
  .png()
  .toBuffer();

const { width: tW, height: tH } = await sharp(trimmedPng).metadata();

// ── 2. Produce each size ──────────────────────────────────────────────────────
for (const { file, px } of SIZES) {
  const pad     = Math.round(px * PADDING_PCT);
  const logoMax = px - pad * 2;
  const scale   = Math.min(logoMax / tW, logoMax / tH);
  const lW      = Math.round(tW * scale);
  const lH      = Math.round(tH * scale);
  const left    = Math.round((px - lW) / 2);
  const top     = Math.round((px - lH) / 2);

  const resizedLogo = await sharp(trimmedPng)
    .resize(lW, lH, { fit: 'fill' })
    .toBuffer();

  await sharp({
    create: { width: px, height: px, channels: 4, background: BG },
  })
    .composite([{ input: resizedLogo, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, file));

  console.log(`✓  ${file}  (${px}×${px})   logo ${lW}×${lH}`);
}

console.log('\nAll icons written to web/public/ — commit them.');
