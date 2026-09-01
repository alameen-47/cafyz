import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  applyLanguageToDocument,
  getActiveLanguageCode,
  isLanguageReady,
  loadLanguage,
  setActiveLanguageCode,
  translatePhrase,
  type AppLang,
} from './index';
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

function debounce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
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
    const apply = () => applyLanguageToDocument(langRef.current);
    apply();

    // DOM-walking translation fights React on native WebViews and can freeze the app.
    if (Capacitor.isNativePlatform()) return;

    const debounced = debounce(apply, 120);
    const observer = new MutationObserver(() => debounced());
    const root = document.getElementById('root');
    if (root) {
      observer.observe(root, { childList: true, subtree: true, characterData: true });
    }
    const onLangEvent = () => debounced();
    window.addEventListener('cafyz-language-changed', onLangEvent);
    return () => {
      observer.disconnect();
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
