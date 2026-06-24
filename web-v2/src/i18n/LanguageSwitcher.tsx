import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Check } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { SUPPORTED_LANGUAGES, type AppLang } from './index';

interface LanguageSwitcherProps {
  /** compact = icon + short code; full = native label on larger screens */
  variant?: 'compact' | 'header' | 'login';
  className?: string;
}

export function LanguageSwitcher({ variant = 'header', className = '' }: LanguageSwitcherProps) {
  const { lang, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = SUPPORTED_LANGUAGES.find(l => l.code === lang) ?? SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (code: AppLang) => {
    setLanguage(code);
    setOpen(false);
  };

  const btnLabel = variant === 'login'
    ? `${t('Language')}: ${current.nativeLabel}`
    : variant === 'compact'
      ? current.short
      : current.nativeLabel;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={t('Language')}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-xl transition-all active:scale-95"
        style={{
          background: 'rgba(30,127,255,0.08)',
          border: '1px solid rgba(30,127,255,0.18)',
          color: '#a8bdd4',
          padding: variant === 'login' ? '8px 12px' : '6px 10px',
          fontSize: variant === 'login' ? '0.82rem' : '0.75rem',
          fontWeight: 600,
          minHeight: variant === 'header' ? 36 : undefined,
        }}
      >
        <Globe size={variant === 'login' ? 15 : 14} style={{ color: '#1e7fff', flexShrink: 0 }} />
        <span className="lang-switcher-label truncate max-w-[5.5rem] sm:max-w-none">{btnLabel}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
            className="absolute right-0 mt-2 z-[80] min-w-[168px] rounded-xl overflow-hidden py-1"
            style={{
              background: '#0d1326',
              border: '1px solid rgba(30,127,255,0.2)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            }}
          >
            {SUPPORTED_LANGUAGES.map(opt => {
              const active = opt.code === lang;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => pick(opt.code)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[rgba(30,127,255,0.08)]"
                >
                  <span style={{ color: '#e8eef8', fontSize: '0.88rem', fontWeight: active ? 700 : 500, flex: 1 }}>
                    {opt.nativeLabel}
                  </span>
                  <span style={{ color: '#6b82a0', fontSize: '0.68rem' }}>{opt.label}</span>
                  {active && <Check size={14} style={{ color: '#1e7fff', flexShrink: 0 }} />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
