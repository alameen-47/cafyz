/** ESC/POS thermal printers expect single-byte text — not UTF-8 multibyte symbols. */

const CHAR_REPLACEMENTS: Record<string, string> = {
  '₹': 'Rs',
  '€': 'EUR',
  '£': 'GBP',
  '৳': 'BDT',
  '₦': 'NGN',
  '¥': 'JPY',
  '…': '...',
  '–': '-',
  '—': '-',
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  '⚠': '!',
};

/** Strip / transliterate text so thermal printers print legible ASCII. */
export function toThermalAscii(text: string): string {
  let out = '';
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp < 0x80) {
      out += char;
      continue;
    }
    const direct = CHAR_REPLACEMENTS[char];
    if (direct) {
      out += direct;
      continue;
    }
    let ascii = '';
    for (const c of char.normalize('NFKD')) {
      const n = c.codePointAt(0)!;
      if (n < 0x80) ascii += c;
    }
    out += ascii || '?';
  }
  return out;
}

export function encodeThermalText(text: string): Uint8Array {
  const safe = toThermalAscii(text);
  const bytes = new Uint8Array(safe.length);
  for (let i = 0; i < safe.length; i++) bytes[i] = safe.charCodeAt(i) & 0x7f;
  return bytes;
}
