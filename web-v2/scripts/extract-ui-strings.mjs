#!/usr/bin/env node
/** Extract candidate UI strings from web-v2 components for i18n coverage checks. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app');
const set = new Set();
const skip = /^(\$|CAFYZ|#|http|\/|\+?\d|•|★|←|→|↵|⌫|PIN|OTP|VIP|PARCEL|ASAP|CAFYZ_|M7 |DD\/|MM\/|YYYY|AED|EUR|GBP|INR|PKR|BDT|NGN|Grill|Cafyz|alex@|staff@|https:|GST)/;

function scanFile(filePath) {
  const s = fs.readFileSync(filePath, 'utf8');
  const patterns = [
    />([^<>{}][^<>{}\n]{2,100})</g,
    /(?:title|label|placeholder|description|subtitle)=\{?["']([^"']{2,100})["']\}?/g,
    /toast\.(?:success|error|info|warning)\(\s*["']([^"']{2,120})["']/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(s))) {
      const t = m[1].trim();
      if (t.length < 3 || t.length > 120) continue;
      if (skip.test(t)) continue;
      if (t.includes('${') || t.includes('{')) continue;
      if (/^[a-z_]+$/.test(t)) continue;
      set.add(t);
    }
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith('.tsx') || ent.name.endsWith('.ts')) scanFile(p);
  }
}

walk(path.join(root, 'components'));
walk(path.join(root, 'config'));

const sorted = [...set].sort((a, b) => b.length - a.length);
console.log(JSON.stringify(sorted, null, 2));
