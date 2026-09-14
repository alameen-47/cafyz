import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, Key, Mail, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "./Toast";
import { licensesApi } from "../../services/api";
import type { ApiSubscriptionStatus } from "../../services/api";
import type { Plan } from "../auth";

interface RenewalBannerProps {
  subscription: ApiSubscriptionStatus | null;
  currentPlan: Plan;
  role: string;
  onGoLicense: () => void;
  onRenewalSubmitted?: () => void;
}

/** Owner-only reminder: free-trial countdown, a licence nearing its end, or one that has ended. */
export function RenewalBanner({
  subscription,
  currentPlan,
  role,
  onGoLicense,
  onRenewalSubmitted,
}: RenewalBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const daysLeft = subscription?.trial_days_left;
  const expired = Boolean(subscription?.trial_expired);
  const onTrial = Boolean(subscription?.on_trial);
  const show = !dismissed && role === "owner" && (expired || onTrial || (daysLeft != null && daysLeft <= 7));

  if (!show) return null;

  const days = daysLeft ?? 0;
  const dayWord = `${days} day${days === 1 ? "" : "s"}`;
  const title = expired
    ? (onTrial ? "Your free trial has ended" : "Your license has ended")
    : onTrial
      ? (days === 0 ? "Your free trial ends today" : `Free trial · ${dayWord} left`)
      : `Your license renews in ${dayWord}`;
  const detail = expired
    ? "Your data is safe. Activate a license key from Cafyz to continue."
    : "Request a license key from Cafyz, then enter it on the License page.";

  const requestKey = async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      await licensesApi.requestPurchase({ plan: currentPlan });
      toast.success("License key requested", "Cafyz will email your key. Enter it on the License page when it arrives.");
      onRenewalSubmitted?.();
    } catch (e) {
      const msg = (e as Error).message;
      if (/pending/i.test(msg)) toast.info("Already requested", "Your key is on its way — check your email.");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="fixed top-0 left-0 right-0 z-[120] px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pointer-events-none"
      >
        <div
          className="mx-auto max-w-3xl rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3 pointer-events-auto shadow-lg"
          style={{
            background: expired ? "var(--cafyz-banner-expired-bg)" : "var(--cafyz-banner-warn-bg)",
            border: `1px solid ${expired ? "rgba(255,59,92,0.35)" : "var(--cafyz-accent-border)"}`,
            boxShadow: "var(--cafyz-shadow-lg)",
          }}
        >
          <AlertTriangle size={20} style={{ color: expired ? "#ff3b5c" : "#f59e0b", flexShrink: 0 }} />
          <div className="flex-1 min-w-[200px]">
            <p style={{ color: "var(--cafyz-text)", fontWeight: 700, fontSize: "0.88rem" }}>{title}</p>
            <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.75rem", marginTop: 2 }}>{detail}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onGoLicense}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}
            >
              <Key size={14} /> Enter key
            </button>
            <button
              type="button"
              onClick={() => void requestKey()}
              disabled={requesting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff", border: "1px solid rgba(30,127,255,0.25)", opacity: requesting ? 0.7 : 1 }}
            >
              {requesting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              {requesting ? "Requesting…" : "Request key"}
            </button>
            {!expired && (
              <button type="button" onClick={() => setDismissed(true)} className="p-1.5 rounded-lg" style={{ color: "var(--cafyz-muted)" }} aria-label="Dismiss">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
