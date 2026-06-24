import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  applyLanguageToDocument,
  getActiveLanguageCode,
  setActiveLanguageCode,
  translatePhrase,
  type AppLang,
} from './index';

interface LanguageContextValue {
  lang: AppLang;
  setLanguage: (code: AppLang) => void;
  t: (text: string) => string;
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
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    const apply = () => applyLanguageToDocument(langRef.current);
    apply();

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
  }, [lang]);

  const setLanguage = useCallback((code: AppLang) => {
    setActiveLanguageCode(code);
    setLangState(code);
    window.dispatchEvent(new CustomEvent('cafyz-language-changed'));
  }, []);

  const t = useCallback((text: string) => translatePhrase(text, lang), [lang]);

  const value = useMemo(() => ({ lang, setLanguage, t }), [lang, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      lang: getActiveLanguageCode(),
      setLanguage: setActiveLanguageCode,
      t: (text: string) => translatePhrase(text, getActiveLanguageCode()),
    };
  }
  return ctx;
}
