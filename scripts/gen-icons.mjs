/**
 * Generate app icons from web/public/logo-source.png for:
 * - Web PWA
 * - Android launcher icons
 * - iOS app icon
 * - Desktop packaging icon
 */

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../web/public/logo-source.png');
const OUT = path.resolve(__dirname, '../web/public');
const ANDROID_RES = path.resolve(__dirname, '../cap-android/app/src/main/res');
const IOS_ICON = path.resolve(__dirname, '../cap-ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
const DESKTOP_ICON = path.resolve(__dirname, '../build/icon.png');

// Tuned paddings:
// - General icons: balanced whitespace for visual centering.
// - Android adaptive foreground: smaller mark so launcher masks never clip.
const PADDING_PCT = 0.12;
const ANDROID_FOREGROUND_PADDING_PCT = 0.24;
// Deep navy/dark-blue background — matches the app's primary accent palette
// and makes the blue/cyan logo pop on the icon.
const BG = { r: 4, g: 12, b: 36, alpha: 1 };

const WEB_SIZES = [
  { file: 'icon-192.png',         px: 192 },
  { file: 'icon-512.png',         px: 512 },
  { file: 'apple-touch-icon.png', px: 180 },
];

const ANDROID_DENSITIES = [
  { dir: 'mipmap-mdpi', px: 48 },
  { dir: 'mipmap-hdpi', px: 72 },
  { dir: 'mipmap-xhdpi', px: 96 },
  { dir: 'mipmap-xxhdpi', px: 144 },
  { dir: 'mipmap-xxxhdpi', px: 192 },
];

// ── 1. Trim white space and re-encode as PNG so sharp can process it reliably ─
const trimmedPng = await sharp(SRC)
  .trim({ background: '#ffffff', threshold: 30 })
  .png()
  .toBuffer();

const { width: tW, height: tH } = await sharp(trimmedPng).metadata();

// ── 2. Produce each size ──────────────────────────────────────────────────────
function renderIconBuffer(px, trim = true, padPct = PADDING_PCT, background = BG) {
  const pad = Math.round(px * padPct);
  const logoMax = px - pad * 2;
  const scale = Math.min(logoMax / tW, logoMax / tH);
  const lW = Math.round(tW * scale);
  const lH = Math.round(tH * scale);
  const left = Math.round((px - lW) / 2);
  const top = Math.round((px - lH) / 2);

  return sharp(trim ? trimmedPng : SRC)
    .resize(lW, lH, { fit: 'fill' })
    .toBuffer()
    .then((resizedLogo) => sharp({
      create: { width: px, height: px, channels: 4, background },
    })
      .composite([{ input: resizedLogo, left, top }])
      .png({ compressionLevel: 9 })
      .toBuffer());
}

// ── 2. Produce web icons ──────────────────────────────────────────────────────
for (const { file, px } of WEB_SIZES) {
  const icon = await renderIconBuffer(px, true);
  await sharp(icon).toFile(path.join(OUT, file));
  console.log(`✓  web/${file} (${px}x${px})`);
}

// ── 3. Produce Android launcher icons ────────────────────────────────────────
for (const { dir, px } of ANDROID_DENSITIES) {
  const launcherIcon = await renderIconBuffer(px, true, PADDING_PCT, BG);
  const foregroundIcon = await renderIconBuffer(
    px,
    true,
    ANDROID_FOREGROUND_PADDING_PCT,
    { r: 0, g: 0, b: 0, alpha: 0 },
  );
  const targetDir = path.join(ANDROID_RES, dir);
  await fs.mkdir(targetDir, { recursive: true });
  await sharp(launcherIcon).toFile(path.join(targetDir, 'ic_launcher.png'));
  await sharp(launcherIcon).toFile(path.join(targetDir, 'ic_launcher_round.png'));
  await sharp(foregroundIcon).toFile(path.join(targetDir, 'ic_launcher_foreground.png'));
  console.log(`✓  android/${dir}/ic_launcher*.png (${px}x${px})`);
}

// ── 4. Produce iOS app icon (1024x1024) ─────────────────────────────────────
await fs.mkdir(path.dirname(IOS_ICON), { recursive: true });
await sharp(await renderIconBuffer(1024, true)).toFile(IOS_ICON);
console.log('✓  ios/AppIcon-512@2x.png (1024x1024)');

// ── 5. Produce desktop packaging icon source ─────────────────────────────────
await fs.mkdir(path.dirname(DESKTOP_ICON), { recursive: true });
await sharp(await renderIconBuffer(1024, true)).toFile(DESKTOP_ICON);
console.log('✓  build/icon.png (1024x1024)');

console.log('\nAll icons were generated from web/public/logo-source.png.');
