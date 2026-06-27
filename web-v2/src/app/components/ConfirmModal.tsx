import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel",
  danger = false, onConfirm, onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: "var(--cafyz-overlay)", backdropFilter: "blur(10px)" }}
          onClick={onCancel}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl p-6 space-y-5"
            style={{
              background: "var(--cafyz-surface)",
              border: `1px solid ${danger ? "rgba(255,59,92,0.25)" : "rgba(30,127,255,0.2)"}`,
              boxShadow: "var(--cafyz-shadow-lg)",
            }}>
            {/* Icon + title */}
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: danger ? "rgba(255,59,92,0.1)" : "var(--cafyz-border)" }}>
                {danger
                  ? <Trash2 size={20} style={{ color: "#ff3b5c" }} />
                  : <AlertTriangle size={20} style={{ color: "#f59e0b" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1rem" }}>
                  {title}
                </h3>
                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.82rem", marginTop: 4, lineHeight: 1.5 }}>
                  {message}
                </p>
              </div>
              <button onClick={onCancel} className="p-1 rounded-lg flex-shrink-0 transition-all hover:bg-[rgba(30,127,255,0.08)]"
                style={{ color: "var(--cafyz-muted)" }}>
                <X size={16} />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5">
              <button onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                style={{ background: "rgba(30,127,255,0.06)", color: "var(--cafyz-text-secondary)", border: "1px solid rgba(30,127,255,0.12)" }}>
                {cancelLabel}
              </button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                style={danger
                  ? { background: "rgba(255,59,92,0.15)", color: "#ff3b5c", border: "1px solid rgba(255,59,92,0.25)" }
                  : { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
                {confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
