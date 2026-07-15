#!/usr/bin/env node
/** Capture App Store screenshots at iPhone 6.7" and iPad 12.9" viewports. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const API = process.env.VITE_API_URL || 'https://cafyz.onrender.com';
const APP = process.env.VITE_APP_URL || 'https://cafyz.ametronyx.com';
const EMAIL = process.env.STORE_DEMO_EMAIL || 'reviewer@cafyz.com';
const PASSWORD = process.env.STORE_DEMO_PASSWORD || 'CafyzReview2026!';

const IPHONE_DIR = path.join(ROOT, 'store-release/ios/screenshots/iphone-6.7');
const IPAD_DIR = path.join(ROOT, 'store-release/ios/screenshots/ipad-12.9');

async function getToken() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${await res.text()}`);
  return (await res.json()).token;
}

async function navSidebar(page, label) {
  const btn = page.locator('aside button, aside a').filter({ hasText: label });
  if (await btn.count()) {
    await btn.first().click({ force: true, timeout: 10000 });
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
}

async function navMobile(page, label) {
  const btn = page.locator('.app-mobile-nav button').filter({ hasText: label });
  if (await btn.count()) {
    await btn.first().click({ force: true, timeout: 10000 });
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
}

async function captureSet(browser, { width, height, scale, outDir, mobile, prefix }) {
  await mkdir(outDir, { recursive: true });
  const token = await getToken();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: 'dark',
    locale: 'en-US',
    isMobile: mobile,
    hasTouch: mobile,
  });
  await context.addInitScript((t) => localStorage.setItem('cafyz_token', t), token);
  const page = await context.newPage();
  await page.goto(APP, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const nav = mobile ? navMobile : navSidebar;
  const shots = [
    { file: `${prefix}01-dashboard.png`, label: mobile ? 'Home' : 'Dashboard' },
    { file: `${prefix}02-pos.png`, label: mobile ? 'POS' : 'Point of Sale' },
    { file: `${prefix}03-orders.png`, label: mobile ? 'Orders' : 'Live Orders' },
    { file: `${prefix}04-tables.png`, label: mobile ? 'Tables' : 'Table Map' },
    { file: `${prefix}05-menu.png`, label: 'Menu' },
    { file: `${prefix}06-kds.png`, label: 'Kitchen Display' },
    { file: `${prefix}07-analytics.png`, label: 'Analytics' },
  ];

  for (const s of shots) {
    if (s.label) await nav(page, s.label).catch(() => false);
    await page.screenshot({ path: path.join(outDir, s.file), fullPage: false });
    console.log(`    → ${path.join(outDir, s.file)}`);
  }
  await context.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    console.log('==> iPhone 6.7" screenshots');
    await captureSet(browser, {
      width: 430, height: 932, scale: 3,
      outDir: IPHONE_DIR, mobile: true, prefix: '',
    });
    console.log('==> iPad 12.9" screenshots');
    await captureSet(browser, {
      width: 1024, height: 1366, scale: 2,
      outDir: IPAD_DIR, mobile: false, prefix: '',
    });
    await writeFile(
      path.join(ROOT, 'store-release/ios/screenshots/CAPTURED.txt'),
      `Captured ${new Date().toISOString()} from ${APP}\n`,
    );
  } finally {
    await browser.close();
  }
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
