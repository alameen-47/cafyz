#!/usr/bin/env node
/**
 * Capture Play Store screenshots from the web app at Android viewport sizes.
 * Same UI as the Capacitor Android shell (web-v2).
 */
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

const PHONE_DIR = path.join(ROOT, 'store-release/android/screenshots/phone');
const TABLET_DIR = path.join(ROOT, 'store-release/android/screenshots/tablet-10');

async function getToken() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${await res.text()}`);
  return (await res.json()).token;
}

async function clickMobileNav(page, label) {
  const btn = page.locator('.app-mobile-nav button').filter({ hasText: label });
  if (await btn.count()) {
    await btn.first().click({ force: true, timeout: 10000 });
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
}

async function clickSidebar(page, label) {
  const link = page.locator('aside button, aside a').filter({ hasText: label });
  if (await link.count()) {
    await link.first().click({ force: true, timeout: 10000 });
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
}

async function captureSet(browser, { width, height, scale, outDir, mobile }) {
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
  await context.addInitScript((t) => {
    localStorage.setItem('cafyz_token', t);
  }, token);

  const page = await context.newPage();
  await page.goto(APP, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const nav = mobile
    ? clickMobileNav
    : clickSidebar;

  const shots = [
    { file: '01-dashboard.png', label: mobile ? 'Home' : 'Dashboard' },
    { file: '02-pos.png', label: mobile ? 'POS' : 'Point of Sale' },
    { file: '03-orders.png', label: mobile ? 'Orders' : 'Live Orders' },
    { file: '04-tables.png', label: mobile ? 'Tables' : 'Table Map' },
    { file: '05-menu.png', label: 'Menu' },
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
    console.log('==> Phone screenshots (412×924 @2.625x → 1080×2424)');
    await captureSet(browser, {
      width: 412,
      height: 924,
      scale: 2.625,
      outDir: PHONE_DIR,
      mobile: true,
    });
    console.log('==> 10" tablet screenshots (1280×800 @1.5x)');
    await captureSet(browser, {
      width: 1280,
      height: 800,
      scale: 1.5,
      outDir: TABLET_DIR,
      mobile: false,
    });
    await writeFile(
      path.join(ROOT, 'store-release/android/screenshots/CAPTURED.txt'),
      `Captured ${new Date().toISOString()} from ${APP}\nPhone: 412×924@2.625x | Tablet: 1280×800@1.5x\n`,
    );
  } finally {
    await browser.close();
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
