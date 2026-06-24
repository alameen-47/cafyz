import { PHRASES_HI } from './phrases.hi';
import { PHRASES_KN } from './phrases.kn';
import { PHRASES_CATALOG_HI, PHRASES_CATALOG_KN } from './phrases.catalog';

export type AppLang = 'en' | 'hi' | 'kn';

export const SUPPORTED_LANGUAGES: { code: AppLang; label: string; nativeLabel: string; short: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', short: 'EN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', short: 'हि' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', short: 'ಕ' },
];

const PHRASE_MAP: Record<Exclude<AppLang, 'en'>, Record<string, string>> = {
  hi: { ...PHRASES_HI, ...PHRASES_CATALOG_HI },
  kn: { ...PHRASES_KN, ...PHRASES_CATALOG_KN },
};

const STORAGE_KEY = 'cafyz_language_code';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'CODE', 'PRE']);
const NUMERIC_ONLY = /^[\d\s%$₹€£.,:;+\-()/'"⭐]+$/;

export function normalizeLangCode(code?: string | null): AppLang {
  const raw = String(code ?? '').trim().toLowerCase();
  if (raw === 'hi' || raw === 'kn') return raw;
  return 'en';
}

export function getActiveLanguageCode(fallback: AppLang = 'en'): AppLang {
  if (typeof localStorage === 'undefined') return fallback;
  return normalizeLangCode(localStorage.getItem(STORAGE_KEY) || fallback);
}

export function setActiveLanguageCode(code?: string | null): void {
  const safe = normalizeLangCode(code);
  localStorage.setItem(STORAGE_KEY, safe);
}

/** Translate a phrase or key; returns English when no translation exists. */
export function translatePhrase(text: string, language: AppLang): string {
  if (!text || language === 'en') return text;
  const map = PHRASE_MAP[language];
  const trimmed = text.trim();
  if (map[trimmed]) return map[trimmed];
  if (map[text]) return map[text];

  let out = text;
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const translated = map[key];
    if (!translated || !out.includes(key)) continue;
    out = out.split(key).join(translated);
  }
  return out;
}

function shouldSkipElement(el: HTMLElement): boolean {
  if (el.closest('[data-i18n-ignore]')) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  return false;
}

function storeAndTranslate(el: HTMLElement, language: AppLang): void {
  const raw = (el.textContent ?? '').trim();
  if (!raw || raw.length > 180 || NUMERIC_ONLY.test(raw)) return;

  let src = el.getAttribute('data-i18n-src');
  if (!src || (language === 'en' && raw !== translatePhrase(src, 'hi') && raw !== translatePhrase(src, 'kn'))) {
    // Refresh source when React re-renders new English copy.
    if (!src || language === 'en' || raw === src || !translatePhrase(raw, 'hi').includes(raw.slice(0, 3))) {
      src = raw;
      el.setAttribute('data-i18n-src', src);
    }
  }

  const translated = translatePhrase(src, language);
  if (language === 'en') {
    if (el.textContent !== src) el.textContent = src;
  } else if (el.textContent !== translated) {
    el.textContent = translated;
  }
}

export function applyLanguageToDocument(language: AppLang, root?: HTMLElement | null): void {
  const target = root ?? document.body;
  if (!target || typeof document === 'undefined') return;

  document.documentElement.lang = language;
  document.documentElement.classList.remove('lang-en', 'lang-hi', 'lang-kn');
  document.documentElement.classList.add(`lang-${language}`);

  // Leaf elements (buttons, labels, headings, table cells, options).
  target.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (shouldSkipElement(el)) return;
    if (el.children.length > 0) return;
    storeAndTranslate(el, language);
  });

  // Placeholders, titles, aria-labels.
  const attrs: Array<'placeholder' | 'title' | 'aria-label'> = ['placeholder', 'title', 'aria-label'];
  target.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (shouldSkipElement(el)) return;
    attrs.forEach((attr) => {
      const val = el.getAttribute(attr);
      if (!val) return;
      const srcKey = `data-i18n-${attr}`;
      let src = el.getAttribute(srcKey) || val;
      if (!el.hasAttribute(srcKey)) el.setAttribute(srcKey, src);
      const translated = translatePhrase(src, language);
      if (language === 'en') el.setAttribute(attr, src);
      else if (translated !== val) el.setAttribute(attr, translated);
    });
  });
}

/** Programmatic translate — use in components for guaranteed coverage. */
export function t(text: string, language?: AppLang): string {
  return translatePhrase(text, language ?? getActiveLanguageCode());
}
