// Central toast helper — wraps sonner with CAFYZ-branded styling
import { toast as sonnerToast } from "sonner";

const base = {
  style: {
    background: "#0d1326",
    border: "1px solid rgba(30,127,255,0.2)",
    color: "#e8eef8",
    borderRadius: "14px",
    fontFamily: "var(--font-body)",
    fontSize: "0.85rem",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    padding: "14px 16px",
  },
};

export const toast = {
  success: (msg: string, desc?: string) =>
    sonnerToast.success(msg, {
      description: desc,
      ...base,
      style: { ...base.style, borderColor: "rgba(34,197,94,0.3)" },
    }),
  error: (msg: string, desc?: string) =>
    sonnerToast.error(msg, {
      description: desc,
      ...base,
      style: { ...base.style, borderColor: "rgba(255,59,92,0.3)" },
    }),
  info: (msg: string, desc?: string) =>
    sonnerToast(msg, {
      description: desc,
      ...base,
    }),
  warning: (msg: string, desc?: string) =>
    sonnerToast.warning(msg, {
      description: desc,
      ...base,
      style: { ...base.style, borderColor: "rgba(245,158,11,0.3)" },
    }),
  loading: (msg: string) =>
    sonnerToast.loading(msg, { ...base }),
  dismiss: (id?: string | number) =>
    sonnerToast.dismiss(id),
  promise: <T,>(
    promise: Promise<T>,
    msgs: { loading: string; success: string; error: string }
  ) =>
    sonnerToast.promise(promise, { ...msgs, ...base }),
};
