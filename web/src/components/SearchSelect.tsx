import { useEffect, useRef, useState } from 'react';
import './SearchSelect.css';

export type SearchSelectOption = { value: string; label: string };

interface SearchSelectProps {
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * Accessible, searchable single-select dropdown (combobox).
 * Native <select> can't host a search field, so this renders a styled trigger
 * that opens a popover with a filter input + the matching options.
 */
export function SearchSelect({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  disabled = false,
  ariaLabel,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Focus the search field when opening; reset filter.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  function choose(val: string) {
    onChange(val);
    setOpen(false);
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const opt = filtered[activeIndex]; if (opt) choose(opt.value); }
  }

  return (
    <div className="ss-root" ref={rootRef}>
      <button
        type="button"
        className="ss-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen(v => !v)}
      >
        <span className={selected ? 'ss-value' : 'ss-value ss-placeholder'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="ss-chevron" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="ss-panel" role="listbox">
          <div className="ss-search">
            <span aria-hidden>🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder={searchPlaceholder}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
          </div>
          <div className="ss-options">
            {filtered.length === 0 ? (
              <p className="ss-empty">No matches</p>
            ) : (
              filtered.map((o, i) => (
                <button
                  key={o.value || '__none__'}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={`ss-option${o.value === value ? ' selected' : ''}${i === activeIndex ? ' active' : ''}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(o.value)}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
