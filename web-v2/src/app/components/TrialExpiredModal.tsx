import { motion } from 'motion/react';
import { Clock } from 'lucide-react';

interface Props {
  expiresAt?: string | null;
  onGoLicense: () => void;
}

export function TrialExpiredModal({ expiresAt, onGoLicense }: Props) {
  const expiryLabel = expiresAt ? new Date(expiresAt).toLocaleDateString() : null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl p-6 text-center"
        style={{ background: '#0d1326', border: '1px solid rgba(255,59,92,0.2)' }}
      >
        <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(255,59,92,0.12)' }}>
          <Clock size={22} style={{ color: '#ff3b5c' }} />
        </div>
        <h2 style={{ color: '#e8eef8', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem' }}>
          Trial expired
        </h2>
        <p style={{ color: '#6b82a0', fontSize: '0.85rem', marginTop: 10, lineHeight: 1.55 }}>
          Your trial has ended{expiryLabel ? ` on ${expiryLabel}` : ''}. Activate a license key to restore POS, kitchen, and manager access.
        </p>
        <button onClick={onGoLicense} className="mt-6 w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg, #1e7fff, #00c6ff)', color: '#fff' }}>
          Go to License →
        </button>
      </motion.div>
    </div>
  );
}
