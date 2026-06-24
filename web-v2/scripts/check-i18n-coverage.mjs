#!/usr/bin/env node
/** Report UI strings missing from the i18n catalog (Hindi/Kannada). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(root, '..', 'src', 'i18n', 'phrases.catalog.ts');
const catalogSrc = fs.readFileSync(catalogPath, 'utf8');
const hiKeys = new Set([...catalogSrc.matchAll(/PHRASES_CATALOG_HI[\s\S]*?'((?:\\'|[^'])*)':/g)].map(m => m[1].replace(/\\'/g, "'")));

const stringsPath = '/tmp/cafyz-clean.json';
if (!fs.existsSync(stringsPath)) {
  console.log('Run: node scripts/extract-ui-strings.mjs > /tmp/cafyz-ui-strings.json first');
  process.exit(1);
}
const ui = JSON.parse(fs.readFileSync(stringsPath, 'utf8')).filter(
  (s) => !/[=<>{}]/.test(s) && s.length >= 3 && s.length <= 90 && !['i &&', 'Couldn', 'Can', 'Passwords don'].includes(s),
);

const missing = ui.filter((s) => !hiKeys.has(s));
console.log(`Catalog keys: ${hiKeys.size}`);
console.log(`UI strings scanned: ${ui.length}`);
console.log(`Missing translations: ${missing.length}`);
if (missing.length) {
  console.log('\nMissing:');
  missing.slice(0, 40).forEach((s) => console.log(' -', s));
  if (missing.length > 40) console.log(` ... and ${missing.length - 40} more`);
}
