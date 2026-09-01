/**
 * Ametronyx maker credit — the AX mark plus the company tagline.
 *
 * Rendered from the same component on every surface (web, Android, iOS and the
 * desktop shells) so the branding cannot drift between installables.
 */
interface AmetronyxCreditProps {
  /** 'compact' for footers, 'full' for about/settings panels. */
  variant?: 'compact' | 'full';
  className?: string;
}

export function AmetronyxCredit({ variant = 'compact', className = '' }: AmetronyxCreditProps) {
  const full = variant === 'full';
  return (
    <div
      // The tagline is a brand string — never machine-translated by the i18n walker.
      data-i18n-ignore
      className={`flex items-center justify-center gap-2.5 ${className}`}
    >
      <img
        src="/ax-logo.png"
        alt="Ametronyx"
        width={full ? 34 : 22}
        height={full ? 34 : 22}
        style={{ objectFit: 'contain', flexShrink: 0 }}
      />
      <span
        style={{
          color: 'var(--cafyz-muted)',
          fontSize: full ? '0.78rem' : '0.68rem',
          lineHeight: 1.35,
          letterSpacing: '0.01em',
          textAlign: 'start',
        }}
      >
        <span style={{ display: 'block', fontStyle: 'italic', opacity: 0.85 }}>
          Born from Innovation.
        </span>
        <span style={{ display: 'block', fontWeight: 600, color: 'var(--cafyz-text-secondary)' }}>
          Built by Ametronyx.
        </span>
      </span>
    </div>
  );
}
