import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CafyzLogo } from "./CafyzLogo";
import { Sparkles, X, Send, User, Minimize2, ReceiptText } from "lucide-react";

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
    text: "Hi! I'm CAFYZ AI. I can help you with sales insights, inventory alerts, staff scheduling, menu suggestions, and more. What do you need?",
    time: now(),
  },
];

const suggestions = [
  "What's today's best-selling item?",
  "Which tables are still open?",
  "Show low stock items",
  "How is revenue trending?",
];

const replies: Record<string, string> = {
  "best-selling": "🏆 Today's top seller is **Chicken Biryani** with 48 orders (₹768 revenue). Mango Lassi and Garlic Naan follow closely.",
  "tables": "🪑 Currently 6 tables are available: T-01, T-08, T-13, T-15, T-17, T-19. 18 tables are occupied (75% occupancy).",
  "low stock": "⚠️ 3 items need restocking:\n• Basmati Rice — 2kg left (min: 10kg)\n• Olive Oil — 0.5L left (min: 5L)\n• Chicken Breast — 8kg (min: 10kg)",
  "revenue": "📈 Revenue is up 12.4% today at ₹52,840. Peak hour was 7pm–8pm. Weekday average is ₹48k — you're outperforming expectations!",
  "default": "I'm looking into that for you... Based on current data, everything looks good! Is there anything specific you'd like me to analyse?",
};

function now() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function getReply(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("best") || lower.includes("sell")) return replies["best-selling"];
  if (lower.includes("table") || lower.includes("open") || lower.includes("available")) return replies["tables"];
  if (lower.includes("stock") || lower.includes("inventory") || lower.includes("low")) return replies["low stock"];
  if (lower.includes("revenue") || lower.includes("trend") || lower.includes("sales")) return replies["revenue"];
  return replies["default"];
}

import { supportApi } from "../../services/api";

export function AIAssistantWidget({ screen, onNewBill }: { screen?: string; onNewBill: () => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
      setMessages(prev => [...prev, { id: `a${Date.now()}`, role: "assistant", text: getReply(msg), time: now() }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <>
      {/* Floating button: new POS bill */}
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        onClick={onNewBill}
        className="fixed bottom-24 lg:bottom-6 left-4 z-40 h-12 rounded-2xl px-4 flex items-center justify-center gap-2 shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #1e7fff, #00c6ff)",
          boxShadow: "0 8px 24px rgba(30,127,255,0.4)",
          color: "#ffffff",
        }}>
        <ReceiptText size={18} />
        <span style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.02em" }}>New Bill</span>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 16 }}
            transition={{ type: "spring", damping: 26, stiffness: 340 }}
            className="fixed bottom-24 lg:bottom-6 left-4 z-50 w-80 sm:w-96 rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: "#0d1326",
              border: "1px solid rgba(168,85,247,0.25)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
              maxHeight: minimised ? "auto" : 480,
            }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(30,127,255,0.08))", borderBottom: "1px solid rgba(168,85,247,0.15)" }}>
              <CafyzLogo size="xs" className="flex-shrink-0" />
              <div className="flex-1">
                <p style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.88rem" }}>CAFYZ AI</p>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
                  <p style={{ color: "#6b82a0", fontSize: "0.65rem" }}>Online · Always learning</p>
                </div>
              </div>
              <button onClick={() => setMinimised(m => !m)}
                className="p-1.5 rounded-lg hover:bg-[rgba(30,127,255,0.1)] transition-all"
                style={{ color: "#6b82a0" }}>
                <Minimize2 size={13} />
              </button>
              <button onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[rgba(255,59,92,0.1)] transition-all"
                style={{ color: "#6b82a0" }}>
                <X size={13} />
              </button>
            </div>

            <AnimatePresence>
              {!minimised && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                  className="flex flex-col overflow-hidden" style={{ flex: 1 }}>
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-3" style={{ maxHeight: 320 }}>
                    {messages.map(m => (
                      <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: m.role === "assistant" ? "linear-gradient(135deg,#a855f7,#1e7fff)" : "rgba(30,127,255,0.2)" }}>
                          {m.role === "assistant" ? <Sparkles size={11} className="text-white" /> : <User size={11} style={{ color: "#1e7fff" }} />}
                        </div>
                        <div className={`max-w-[75%] space-y-1 ${m.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                          <div className="px-3 py-2 rounded-xl"
                            style={m.role === "assistant"
                              ? { background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.15)" }
                              : { background: "rgba(30,127,255,0.15)", border: "1px solid rgba(30,127,255,0.2)" }}>
                            <p style={{ color: "#e8eef8", fontSize: "0.78rem", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.text}</p>
                          </div>
                          <p style={{ color: "#6b82a0", fontSize: "0.62rem" }}>{m.time}</p>
                        </div>
                      </div>
                    ))}
                    {typing && (
                      <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: "linear-gradient(135deg,#a855f7,#1e7fff)" }}>
                          <Sparkles size={11} className="text-white" />
                        </div>
                        <div className="px-3 py-2 rounded-xl flex items-center gap-1.5"
                          style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.15)" }}>
                          {[0,1,2].map(i => (
                            <motion.div key={i}
                              animate={{ y: [-2, 2, -2] }}
                              transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: "#a855f7" }} />
                          ))}
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Suggestions */}
                  <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
                    {suggestions.map(s => (
                      <button key={s} onClick={() => send(s)}
                        className="px-2.5 py-1 rounded-full text-xs whitespace-nowrap flex-shrink-0 transition-all hover:opacity-80"
                        style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.2)" }}>
                        {s}
                      </button>
                    ))}
                  </div>

                  {/* Input */}
                  <div className="p-3 border-t flex gap-2" style={{ borderColor: "rgba(168,85,247,0.12)" }}>
                    <input
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                      placeholder="Ask anything about your restaurant..."
                      className="flex-1 rounded-xl px-3 py-2 text-sm outline-none placeholder:text-[#6b82a0]"
                      style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(168,85,247,0.15)" }}
                    />
                    <motion.button whileTap={{ scale: 0.92 }} onClick={() => send()}
                      disabled={!input.trim()}
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        background: input.trim() ? "linear-gradient(135deg, #a855f7, #1e7fff)" : "rgba(107,130,160,0.1)",
                        color: input.trim() ? "#fff" : "#6b82a0",
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
