import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, Mail, X, Loader2 } from "lucide-react";
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
  const show = !dismissed && role !== "founder" && role === "owner" && (expired || (daysLeft != null && daysLeft <= 3));

  if (!show) return null;

  const founderEmail = subscription?.founder_email ?? "cafyzofficial@gmail.com";

  const contactRenewal = async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      await licensesApi.requestPurchase({ plan: currentPlan });
      toast.success("Renewal request sent", `Cafyz (${founderEmail}) will review your request by email.`);
      onRenewalSubmitted?.();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("pending")) toast.info("Request already pending", "Check your email for updates from Cafyz.");
      else toast.error("Couldn't send request", msg);
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
            background: expired ? "linear-gradient(135deg, #2a1020, #1a0d26)" : "linear-gradient(135deg, #0d2040, var(--cafyz-surface))",
            border: `1px solid ${expired ? "rgba(255,59,92,0.35)" : "rgba(30,127,255,0.35)"}`,
            boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          }}
        >
          <AlertTriangle size={20} style={{ color: expired ? "#ff3b5c" : "#f59e0b", flexShrink: 0 }} />
          <div className="flex-1 min-w-[200px]">
            <p style={{ color: "var(--cafyz-text)", fontWeight: 700, fontSize: "0.88rem" }}>
              {expired ? "Subscription expired — renew to restore access" : `Renewal due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
            </p>
            <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.75rem", marginTop: 2 }}>
              Contact Cafyz at{" "}
              <a href={`mailto:${founderEmail}`} style={{ color: "#1e7fff", textDecoration: "underline" }}>
                {founderEmail}
              </a>
              {" "}— we'll email you when approved.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => void contactRenewal()}
              disabled={requesting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: requesting ? 0.7 : 1 }}
            >
              {requesting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              {requesting ? "Sending…" : "Contact to renew"}
            </button>
            <button
              type="button"
              onClick={onGoLicense}
              className="px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff", border: "1px solid rgba(30,127,255,0.25)" }}
            >
              License
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
