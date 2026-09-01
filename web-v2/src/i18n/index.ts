import {
  SUPPORTED_LANGUAGES,
  dirFor,
  isSupportedLang,
  languageMeta,
  type AppLang,
  type LanguageMeta,
  type TextDir,
} from './languages';

export type { AppLang, LanguageMeta, TextDir };
export { SUPPORTED_LANGUAGES, dirFor, languageMeta };

/**
 * Phrase bundles are code-split and fetched on demand.
 *
 * Eleven languages inlined would add roughly a megabyte to the entry chunk for
 * strings all but one user never sees. Each bundle is a separate dynamic import,
 * so a visitor downloads English plus at most their own language.
 */
const LOADERS: Record<Exclude<AppLang, 'en'>, () => Promise<Record<string, string>>> = {
  hi: async () => {
    const [base, cat] = await Promise.all([import('./phrases.hi'), import('./phrases.catalog')]);
    return { ...base.PHRASES_HI, ...cat.PHRASES_CATALOG_HI };
  },
  kn: async () => {
    const [base, cat] = await Promise.all([import('./phrases.kn'), import('./phrases.catalog')]);
    return { ...base.PHRASES_KN, ...cat.PHRASES_CATALOG_KN };
  },
  ar: async () => (await import('./phrases.ar')).PHRASES_AR,
  ur: async () => (await import('./phrases.ur')).PHRASES_UR,
  bn: async () => (await import('./phrases.bn')).PHRASES_BN,
  te: async () => (await import('./phrases.te')).PHRASES_TE,
  mr: async () => (await import('./phrases.mr')).PHRASES_MR,
  ta: async () => (await import('./phrases.ta')).PHRASES_TA,
  gu: async () => (await import('./phrases.gu')).PHRASES_GU,
  ml: async () => (await import('./phrases.ml')).PHRASES_ML,
};

/** Bundles already resolved. Missing entry = fall back to English. */
const loadedPhrases: Partial<Record<AppLang, Record<string, string>>> = {};
const inflight: Partial<Record<AppLang, Promise<void>>> = {};

/** Fetch a language's phrases. Safe to call repeatedly; resolves immediately once cached. */
export function loadLanguage(lang: AppLang): Promise<void> {
  if (lang === 'en' || loadedPhrases[lang]) return Promise.resolve();
  const existing = inflight[lang];
  if (existing) return existing;
  const task = LOADERS[lang]()
    .then((map) => { loadedPhrases[lang] = map; })
    .catch(() => { /* leave unloaded — translatePhrase falls back to English */ })
    .finally(() => { delete inflight[lang]; });
  inflight[lang] = task;
  return task;
}

/** True once a language's phrases are in memory (English is always ready). */
export function isLanguageReady(lang: AppLang): boolean {
  return lang === 'en' || !!loadedPhrases[lang];
}

const STORAGE_KEY = 'cafyz_language_code';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'CODE', 'PRE']);
const NUMERIC_ONLY = /^[\d\s%$₹€£.,:;+\-()/'"⭐]+$/;

export function normalizeLangCode(code?: string | null): AppLang {
  // Accept BCP-47 tags too ("ar-AE", "hi_IN") so device/browser locales resolve.
  const raw = String(code ?? '').trim().toLowerCase().replace('_', '-').split('-')[0];
  return isSupportedLang(raw) ? raw : 'en';
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
  const map = loadedPhrases[language];
  // Bundle not fetched yet (or failed) — English is the fallback, never a blank.
  if (!map) return text;
  const trimmed = text.trim();
  if (map[trimmed]) return map[trimmed];
  if (map[text]) return map[text];

  // Fall back to replacing known phrases inside a longer string, longest first.
  // Matches must sit on word boundaries: without that, "Total" hits inside
  // "Daily Totals" and yields half-translated text like "Daily الإجماليs".
  let out = text;
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const translated = map[key];
    // Very short keys ("All", "Add") collide constantly inside longer words.
    if (!translated || key.length < 4 || !out.includes(key)) continue;
    out = replaceOnWordBoundary(out, key, translated);
  }
  return out;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Replace every occurrence of `key` not glued to a letter or digit either side. */
function replaceOnWordBoundary(haystack: string, key: string, replacement: string): string {
  let out = '';
  let i = 0;
  while (i < haystack.length) {
    const at = haystack.indexOf(key, i);
    if (at === -1) { out += haystack.slice(i); break; }
    const before = at === 0 ? '' : haystack[at - 1];
    const after = haystack[at + key.length] ?? '';
    const bounded = !WORD_CHAR.test(before) && !WORD_CHAR.test(after);
    out += haystack.slice(i, at) + (bounded ? replacement : key);
    i = at + key.length;
  }
  return out;
}

function shouldSkipElement(el: HTMLElement): boolean {
  if (el.closest('[data-i18n-ignore]')) return true;
  // Third-party islands (e.g. Google's rendered sign-in button) own their own
  // localisation; rewriting their markup corrupts it.
  if (el.closest('[data-i18n-skip], [translate="no"]')) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  return false;
}

function storeAndTranslate(el: HTMLElement, language: AppLang): void {
  const raw = (el.textContent ?? '').trim();
  if (!raw || raw.length > 180 || NUMERIC_ONLY.test(raw)) return;

  let src = el.getAttribute('data-i18n-src');
  // Refresh the stored source when React renders new English copy. `raw` is a
  // translation (not new source) only if it differs from what we'd render for
  // the active language, so compare against that rather than a fixed language.
  if (!src || (language === 'en' && raw !== translatePhrase(src, language))) {
    src = raw;
    el.setAttribute('data-i18n-src', src);
  }

  const translated = translatePhrase(src, language);
  if (language === 'en') {
    if (el.textContent !== src) el.textContent = src;
  } else if (el.textContent !== translated) {
    el.textContent = translated;
  }

  // In an RTL document, a still-English string is reordered by the bidi
  // algorithm when it starts with a digit or symbol — "7-Day Revenue" renders
  // as "Day Revenue-7", and a clock as "PM 05:03". Marking untranslated leaves
  // dir="auto" lets the browser infer LTR from their first strong character.
  // Only touch elements we own, so an author-set dir is never overwritten.
  if (dirFor(language) === 'rtl' && translated === src) {
    if (el.getAttribute('dir') !== 'auto' && !el.hasAttribute('data-i18n-dir')) {
      el.setAttribute('dir', 'auto');
      el.setAttribute('data-i18n-dir', 'auto');
    }
  } else if (el.getAttribute('data-i18n-dir') === 'auto') {
    el.removeAttribute('dir');
    el.removeAttribute('data-i18n-dir');
  }
}

export function applyLanguageToDocument(language: AppLang, root?: HTMLElement | null): void {
  const target = root ?? document.body;
  if (!target || typeof document === 'undefined') return;

  const dir = dirFor(language);
  document.documentElement.lang = language;
  document.documentElement.dataset.i18nDir = dir;
  document.documentElement.dir = dir;
  // Some layout is easier to fix with a hook than with logical properties alone.
  document.documentElement.classList.toggle('rtl', dir === 'rtl');
  SUPPORTED_LANGUAGES.forEach((l) => document.documentElement.classList.remove(`lang-${l.code}`));
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
