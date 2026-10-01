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
    .then((map) => { loadedPhrases[lang] = map; resetLanguageCaches(lang); })
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

/**
 * Keys eligible for inside-a-sentence replacement, longest first.
 *
 * Sorting is O(n log n) over roughly a thousand keys. Done per call it dwarfed
 * the translation itself on busy screens, so each language sorts once and the
 * result is reused until that bundle is replaced.
 */
const sortedKeysCache: Partial<Record<AppLang, string[]>> = {};

function substitutableKeys(language: AppLang, map: Record<string, string>): string[] {
  const cached = sortedKeysCache[language];
  if (cached) return cached;
  const keys = Object.keys(map)
    // Very short keys ("All", "Add") collide constantly inside longer words.
    .filter((k) => k.length >= 4 && !!map[k])
    .sort((a, b) => b.length - a.length);
  sortedKeysCache[language] = keys;
  return keys;
}

/**
 * Results already computed, per language. The same few hundred strings are
 * re-translated on every pass, so this turns repeat work into a map lookup.
 */
const phraseCache: Partial<Record<AppLang, Map<string, string>>> = {};

function cacheFor(language: AppLang): Map<string, string> {
  let c = phraseCache[language];
  if (!c) { c = new Map(); phraseCache[language] = c; }
  return c;
}

/** Drop memoised work for a language once its bundle lands or changes. */
function resetLanguageCaches(language: AppLang): void {
  delete sortedKeysCache[language];
  delete phraseCache[language];
}

/** Translate a phrase or key; returns English when no translation exists. */
export function translatePhrase(text: string, language: AppLang): string {
  if (!text || language === 'en') return text;
  const map = loadedPhrases[language];
  // Bundle not fetched yet (or failed) — English is the fallback, never a blank.
  if (!map) return text;

  const cache = cacheFor(language);
  const hit = cache.get(text);
  if (hit !== undefined) return hit;

  const result = computeTranslation(text, map, language);
  // Bounded so a screen full of unique strings (order notes, guest names)
  // cannot grow this without limit.
  if (cache.size > 5000) cache.clear();
  cache.set(text, result);
  return result;
}

function computeTranslation(text: string, map: Record<string, string>, language: AppLang): string {
  const trimmed = text.trim();
  if (map[trimmed]) return map[trimmed];
  if (map[text]) return map[text];

  // Fall back to replacing known phrases inside a longer string, longest first.
  // Matches must sit on word boundaries: without that, "Total" hits inside
  // "Daily Totals" and yields half-translated text like "Daily الإجماليs".
  let out = text;
  for (const key of substitutableKeys(language, map)) {
    if (!out.includes(key)) continue;
    out = replaceOnWordBoundary(out, key, map[key]);
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

/**
 * What this module last wrote into an element: the English source and the text
 * it rendered for the then-active language.
 *
 * Telling "React rendered fresh English copy" apart from "we translated this
 * element earlier" needs a record of our own writes. Comparing the DOM against
 * the English source instead (the previous approach) reads any translated text
 * as new source, which is why switching back to English used to leave the UI in
 * the old language until a reload. Keyed weakly, so elements React discards are
 * collected with it.
 */
interface ElementRecord { src: string; rendered: string }
const written = new WeakMap<Element, ElementRecord>();

function storeAndTranslate(el: HTMLElement, language: AppLang): void {
  const raw = (el.textContent ?? '').trim();
  if (!raw || raw.length > 180 || NUMERIC_ONLY.test(raw)) return;

  const prev = written.get(el);
  // Still exactly what we wrote → the English source is the one we recorded.
  // Anything else came from React, and React always renders English source.
  const src = prev && prev.rendered === raw ? prev.src : raw;

  const translated = language === 'en' ? src : translatePhrase(src, language);
  if (el.textContent !== translated) el.textContent = translated;
  written.set(el, { src, rendered: translated });

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

const TRANSLATED_ATTRS: Array<'placeholder' | 'title' | 'aria-label'> = ['placeholder', 'title', 'aria-label'];

/**
 * True once any element has been rewritten into a non-English language.
 *
 * English is the default and the overwhelming common case. With nothing ever
 * translated there is no English to restore, so the whole walk is skippable —
 * which is what keeps an idle English screen at zero translation work.
 */
let documentTranslated = false;

/** Marks an element (and its subtree) as owned by someone else's localisation. */
function isSkipRoot(el: Element): boolean {
  if (SKIP_TAGS.has(el.tagName)) return true;
  return el.hasAttribute('data-i18n-ignore')
    || el.hasAttribute('data-i18n-skip')
    || el.getAttribute('translate') === 'no';
}

/** Same bookkeeping as `written`, for the attributes we translate. */
const writtenAttrs = new WeakMap<Element, Record<string, ElementRecord>>();

/** Rewrite one element's translated attributes, writing only on a real change. */
function translateAttributes(el: HTMLElement, language: AppLang): void {
  let records: Record<string, ElementRecord> | undefined;
  for (const attr of TRANSLATED_ATTRS) {
    const val = el.getAttribute(attr);
    if (!val) continue;
    records = records ?? writtenAttrs.get(el);
    const prev = records?.[attr];
    // Unchanged since our write → the recorded English source still stands;
    // otherwise React supplied this value and it becomes the new source. The
    // old code stashed the source in a data- attribute on first sight, which
    // captured an already-translated value and stuck that attribute forever.
    const src = prev && prev.rendered === val ? prev.src : val;
    const next = language === 'en' ? src : translatePhrase(src, language);
    // Re-writing identical values on every pass is what kept an idle screen
    // churning out attribute mutations.
    if (next !== val) el.setAttribute(attr, next);
    if (!records) { records = {}; writtenAttrs.set(el, records); }
    records[attr] = { src, rendered: next };
  }
}

/**
 * Translate a subtree in a single pass.
 *
 * One TreeWalker replaces two full `querySelectorAll('*')` sweeps, and skip
 * containers are pruned whole rather than re-tested with `closest()` per
 * element.
 */
export function translateSubtree(root: Element, language: AppLang): void {
  if (typeof document === 'undefined') return;
  if (language === 'en' && !documentTranslated) return;
  if (language !== 'en') documentTranslated = true;

  // An ancestor outside this subtree may own it (incremental calls land deep).
  if (root.closest('[data-i18n-ignore], [data-i18n-skip], [translate="no"]')) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const el = node as Element;
      if (isSkipRoot(el)) return NodeFilter.FILTER_REJECT;   // prunes the subtree
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const start = root as HTMLElement;
  if (!isSkipRoot(start)) {
    translateAttributes(start, language);
    if (start.children.length === 0) storeAndTranslate(start, language);
  }

  let node = walker.nextNode();
  while (node) {
    const el = node as HTMLElement;
    translateAttributes(el, language);
    // Only leaves carry translatable copy; containers are reached through them.
    if (el.children.length === 0) storeAndTranslate(el, language);
    node = walker.nextNode();
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

  translateSubtree(target, language);
}

/** Programmatic translate — use in components for guaranteed coverage. */
export function t(text: string, language?: AppLang): string {
  return translatePhrase(text, language ?? getActiveLanguageCode());
}
