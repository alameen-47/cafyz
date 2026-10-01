import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  applyLanguageToDocument,
  getActiveLanguageCode,
  isLanguageReady,
  loadLanguage,
  setActiveLanguageCode,
  translatePhrase,
  translateSubtree,
  type AppLang,
} from './index';

const OBSERVE_OPTS: MutationObserverInit = { childList: true, subtree: true, characterData: true };
import { dirFor, type TextDir } from './languages';

interface LanguageContextValue {
  lang: AppLang;
  /** 'rtl' for Arabic and Urdu. */
  dir: TextDir;
  setLanguage: (code: AppLang) => void;
  t: (text: string) => string;
  /** False while a language bundle is still downloading (English renders meanwhile). */
  ready: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Run `fn` when the main thread is next free, falling back to a short timer. */
function onIdle(fn: () => void): () => void {
  const ric = (window as unknown as {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  });
  if (typeof ric.requestIdleCallback === 'function') {
    const id = ric.requestIdleCallback(fn, { timeout: 200 });
    return () => ric.cancelIdleCallback?.(id);
  }
  const id = setTimeout(fn, 16);
  return () => clearTimeout(id);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLang>(() => getActiveLanguageCode());
  // Bumped once a bundle lands, so translations re-render without a reload.
  const [phrasesVersion, setPhrasesVersion] = useState(0);
  const langRef = useRef(lang);
  langRef.current = lang;

  // Fetch the active language's phrases (no-op for English or an already-cached
  // bundle). Until it resolves, translatePhrase returns the English source.
  useEffect(() => {
    let alive = true;
    if (isLanguageReady(lang)) { setPhrasesVersion((v) => v + 1); return; }
    void loadLanguage(lang).then(() => {
      if (alive) setPhrasesVersion((v) => v + 1);
    });
    return () => { alive = false; };
  }, [lang]);

  useEffect(() => {
    const root = document.getElementById('root');
    const applyAll = () => applyLanguageToDocument(langRef.current);
    applyAll();

    // DOM-walking translation fights React on native WebViews and can freeze the app.
    if (Capacitor.isNativePlatform()) return;

    // Only the parts React actually changed are re-translated. Re-walking the
    // whole page on every mutation meant a screen with a ticking clock paid for
    // a full-document pass every second.
    let pending = new Set<Element>();
    let cancel: (() => void) | null = null;
    let observer: MutationObserver | null = null;

    const flush = () => {
      cancel = null;
      const targets = pending;
      pending = new Set();
      if (!targets.size) return;
      // Our own rewrites would otherwise queue another round of work.
      observer?.disconnect();
      try {
        for (const el of targets) {
          if (el.isConnected) translateSubtree(el, langRef.current);
        }
      } finally {
        if (root) observer?.observe(root, OBSERVE_OPTS);
      }
    };

    const schedule = () => { if (!cancel) cancel = onIdle(flush); };

    observer = new MutationObserver((records) => {
      for (const rec of records) {
        // characterData fires on the text node; its element owns the copy.
        const node = rec.type === 'characterData' ? rec.target.parentElement : rec.target as Element;
        const el = node?.nodeType === 1 ? (node as Element) : null;
        if (el) pending.add(el);
      }
      if (pending.size) schedule();
    });
    if (root) observer.observe(root, OBSERVE_OPTS);

    const onLangEvent = () => { if (root) pending.add(root); schedule(); };
    window.addEventListener('cafyz-language-changed', onLangEvent);
    return () => {
      cancel?.();
      observer?.disconnect();
      window.removeEventListener('cafyz-language-changed', onLangEvent);
    };
  }, [lang, phrasesVersion]);

  const setLanguage = useCallback((code: AppLang) => {
    setActiveLanguageCode(code);
    // Warm the bundle before switching so the UI flips straight to the new
    // language instead of flashing English first.
    void loadLanguage(code).then(() => {
      setLangState(code);
      setPhrasesVersion((v) => v + 1);
      window.dispatchEvent(new CustomEvent('cafyz-language-changed'));
    });
  }, []);

  // phrasesVersion is a dependency so `t` is re-created once a bundle arrives.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const t = useCallback((text: string) => translatePhrase(text, lang), [lang, phrasesVersion]);

  const dir = dirFor(lang);
  const ready = isLanguageReady(lang);
  const value = useMemo(
    () => ({ lang, dir, setLanguage, t, ready }),
    [lang, dir, setLanguage, t, ready],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    const fallbackLang = getActiveLanguageCode();
    return {
      lang: fallbackLang,
      dir: dirFor(fallbackLang),
      setLanguage: setActiveLanguageCode,
      t: (text: string) => translatePhrase(text, fallbackLang),
      ready: isLanguageReady(fallbackLang),
    };
  }
  return ctx;
}
