import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CafyzLogo } from "./CafyzLogo";
import { HScroll } from "./HScroll";
import { X, Send, User, Minimize2, ReceiptText, LifeBuoy } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
}

const initialMessages: Message[] = [
  {
    id: "m0",
    role: "assistant",
    text: "Hi! Ask me how to do anything in Cafyz — billing, the kitchen screen, tables, stock, staff or reports.",
    time: now(),
  },
];

const suggestions = [
  "What's today's best-selling item?",
  "Which tables are still open?",
  "Show low stock items",
  "How is revenue trending?",
];


function now() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

/** Shown when the help service cannot be reached; never a made-up answer. */
const OFFLINE_REPLY = "I can't reach Cafyz help right now. Check your connection and try again in a moment.";

import { supportApi } from "../../services/api";

export function AIAssistantWidget({ screen, onNewBill }: { screen?: string; onNewBill: () => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hideNewBillFab = screen === "pos" || screen === "kds";

  useEffect(() => {
    if (open && !minimised) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [messages, open, minimised]);

  useEffect(() => {
    const handler = () => {
      setMinimised(false);
      setOpen(true);
    };
    window.addEventListener("cafyz:open-support", handler);
    return () => window.removeEventListener("cafyz:open-support", handler);
  }, []);

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");

    const userMsg: Message = { id: `u${Date.now()}`, role: "user", text: msg, time: now() };
    setMessages(prev => [...prev, userMsg]);
    setTyping(true);

    try {
      const history = [...messages, userMsg].slice(-6).map(m => ({ role: m.role, text: m.text }));
      const res = await supportApi.ask({ message: msg, screen, history });
      setMessages(prev => [...prev, { id: `a${Date.now()}`, role: "assistant", text: res.reply, time: now() }]);
    } catch (e) {
      setMessages(prev => [...prev, { id: `a${Date.now()}`, role: "assistant", text: OFFLINE_REPLY, time: now() }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <>
      {/* Floating button: new POS bill */}
      {!hideNewBillFab && (
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        onClick={onNewBill}
        className="fixed app-fab md:bottom-6 left-4 z-40 h-12 rounded-full px-5 hidden md:flex items-center justify-center gap-2 shadow-2xl"
        style={{
          background: "var(--cafyz-gradient)",
          boxShadow: "0 8px 24px rgba(var(--cafyz-brand-rgb),0.4)",
          color: "#ffffff",
        }}>
        <ReceiptText size={18} />
        <span style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.02em" }}>New Bill</span>
      </motion.button>
      )}

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 16 }}
            transition={{ type: "spring", damping: 26, stiffness: 340 }}
            className="fixed app-fab app-help-panel md:bottom-6 left-4 right-4 sm:right-auto sm:w-96 z-50 rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: "var(--cafyz-surface)",
              border: "1px solid rgba(var(--cafyz-brand-rgb),0.25)",
              boxShadow: "var(--cafyz-shadow-lg)",
              ...(minimised ? { maxHeight: "none" } : {}),
            }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(var(--cafyz-brand-rgb),0.12), rgba(var(--cafyz-brand-rgb),0.08))", borderBottom: "1px solid rgba(var(--cafyz-brand-rgb),0.15)" }}>
              <CafyzLogo size="xs" className="flex-shrink-0" />
              <div className="flex-1">
                <p style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.88rem" }}>Cafyz Help</p>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#00d68f" }} />
                  <p style={{ color: "var(--cafyz-muted)", fontSize: "0.65rem" }}>Ask about any screen</p>
                </div>
              </div>
              <button onClick={() => setMinimised(m => !m)}
                className="p-1.5 rounded-lg hover:bg-[var(--cafyz-border)] transition-all"
                style={{ color: "var(--cafyz-muted)" }}>
                <Minimize2 size={13} />
              </button>
              <button onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[rgba(255,65,108,0.1)] transition-all"
                style={{ color: "var(--cafyz-muted)" }}>
                <X size={13} />
              </button>
            </div>

            <AnimatePresence>
              {!minimised && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                  className="flex flex-col overflow-hidden min-h-0" style={{ flex: 1 }}>
                  {/* Messages */}
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-hide p-3 space-y-3" style={{ maxHeight: 320 }}>
                    {messages.map(m => (
                      <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: m.role === "assistant" ? "var(--cafyz-gradient)" : "rgba(var(--cafyz-brand-rgb),0.2)" }}>
                          {m.role === "assistant" ? <LifeBuoy size={12} className="text-white" /> : <User size={11} style={{ color: "var(--cafyz-brand)" }} />}
                        </div>
                        <div className={`max-w-[75%] space-y-1 ${m.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                          <div className="px-3 py-2 rounded-xl"
                            style={m.role === "assistant"
                              ? { background: "rgba(var(--cafyz-brand-rgb),0.1)", border: "1px solid rgba(var(--cafyz-brand-rgb),0.15)" }
                              : { background: "rgba(var(--cafyz-brand-rgb),0.15)", border: "1px solid rgba(var(--cafyz-brand-rgb),0.2)" }}>
                            <p style={{ color: "var(--cafyz-text)", fontSize: "0.78rem", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.text}</p>
                          </div>
                          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.62rem" }}>{m.time}</p>
                        </div>
                      </div>
                    ))}
                    {typing && (
                      <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: "var(--cafyz-gradient)" }}>
                          <LifeBuoy size={12} className="text-white" />
                        </div>
                        <div className="px-3 py-2 rounded-xl flex items-center gap-1.5"
                          style={{ background: "rgba(var(--cafyz-brand-rgb),0.1)", border: "1px solid rgba(var(--cafyz-brand-rgb),0.15)" }}>
                          {[0,1,2].map(i => (
                            <motion.div key={i}
                              animate={{ y: [-2, 2, -2] }}
                              transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: "var(--cafyz-brand)" }} />
                          ))}
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Suggestions */}
                  <HScroll className="px-3 pb-2 gap-1.5 flex-shrink-0">
                    {suggestions.map(s => (
                      <button key={s} onClick={() => send(s)}
                        className="px-2.5 py-1 rounded-full text-xs whitespace-nowrap flex-shrink-0 transition-all hover:opacity-80"
                        style={{ background: "rgba(var(--cafyz-brand-rgb),0.1)", color: "var(--cafyz-brand)", border: "1px solid rgba(var(--cafyz-brand-rgb),0.2)" }}>
                        {s}
                      </button>
                    ))}
                  </HScroll>

                  {/* Input */}
                  <div className="p-3 border-t flex gap-2 flex-shrink-0" style={{ borderColor: "rgba(var(--cafyz-brand-rgb),0.12)" }}>
                    <input
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                      placeholder="Ask anything about your restaurant..."
                      className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm outline-none placeholder:text-[var(--cafyz-muted)]"
                      style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(var(--cafyz-brand-rgb),0.15)" }}
                    />
                    <motion.button whileTap={{ scale: 0.92 }} onClick={() => send()}
                      disabled={!input.trim()}
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        background: input.trim() ? "var(--cafyz-gradient)" : "rgba(166,160,199,0.1)",
                        color: input.trim() ? "#fff" : "var(--cafyz-muted)",
                      }}>
                      <Send size={14} />
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
