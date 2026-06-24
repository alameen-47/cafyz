import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { MapPin, Search, Shield } from "lucide-react";
import { CafyzLogo } from "./CafyzLogo";
import { publicApi, type PublicMenuResponse } from "../../services/api";
import { getCurrencySymbol } from "../../utils/currency";
import { useAuth } from "../auth";
import { subscribeMenuChanged } from "../../utils/menuEvents";

function urlRestaurantId(): string | null {
  const m = window.location.pathname.match(/\/m\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function PublicMenu({ restaurantId }: { restaurantId?: string }) {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<PublicMenuResponse | null>(null);
  const [err, setErr] = useState("");
  const catRef = useRef<HTMLDivElement>(null);

  const rid = restaurantId || urlRestaurantId() || user?.restaurant_id || "";

  const loadMenu = useCallback(() => {
    if (!rid) { setErr("No restaurant specified."); return Promise.resolve(); }
    setErr("");
    return publicApi.menu(rid, { fresh: true }).then(setData).catch(e => setErr((e as Error).message));
  }, [rid]);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  // Keep the customer menu in sync — poll + refresh when tab is focused or menu edits fire.
  useEffect(() => {
    if (!rid) return;
    const timer = window.setInterval(() => { void loadMenu(); }, 20_000);
    const onFocus = () => { void loadMenu(); };
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadMenu();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const unsub = subscribeMenuChanged(() => { void loadMenu(); });
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      unsub();
    };
  }, [rid, loadMenu]);

  const cur = getCurrencySymbol(data?.restaurant.currency_code);
  const labelBySlug = new Map((data?.categories ?? []).map(c => [c.slug, c.label]));
  const categories = ["All", ...(data?.categories ?? []).map(c => c.label)];
  const items = (data?.items ?? []).map(m => ({
    id: m.id,
    name: m.name,
    cat: labelBySlug.get(m.category) ?? m.category,
    price: m.price,
    description: m.description,
    popular: m.is_popular === 1,
    image: m.image_url || "",
  }));

  const filtered = items.filter(m =>
    (activeCategory === "All" || m.cat === activeCategory) &&
    (search === "" || m.name.toLowerCase().includes(search.toLowerCase()))
  );

  const restaurant = data?.restaurant;
  const location = [restaurant?.city, restaurant?.country].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen" style={{ background: "#06091a" }}>
      {/* Hero */}
      <div
        className="relative px-4 pt-12 pb-8 text-center overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #080d1e 0%, #0a1535 60%, #06091a 100%)",
          borderBottom: "1px solid rgba(30,127,255,0.12)",
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-10" style={{ background: "#1e7fff" }} />
        </div>
        <div className="relative">
          <div
            className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center overflow-hidden"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", boxShadow: "0 0 32px rgba(30,127,255,0.4)" }}
          >
            {restaurant?.logo_url
              ? <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" />
              : <Shield size={32} className="text-white" />}
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff", fontSize: "1.8rem" }}>
            {restaurant?.name ?? (err ? "Menu unavailable" : "Loading…")}
          </h1>
          {restaurant?.tagline && <p style={{ color: "#a8bdd4", marginTop: 4, fontSize: "0.9rem" }}>{restaurant.tagline}</p>}
          {location && (
            <div className="flex items-center justify-center gap-4 mt-3">
              <div className="flex items-center gap-1" style={{ color: "#6b82a0", fontSize: "0.78rem" }}>
                <MapPin size={12} /> {location}
              </div>
            </div>
          )}
        </div>
      </div>

      {err && !restaurant ? (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p style={{ color: "#6b82a0", fontSize: "0.85rem" }}>{err}</p>
        </div>
      ) : (
        <>
          {/* Sticky category + search bar */}
          <div
            className="sticky top-0 z-10 px-4 py-3 space-y-3"
            style={{ background: "rgba(6,9,26,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(30,127,255,0.08)" }}
          >
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 max-w-lg mx-auto"
              style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.12)" }}>
              <Search size={14} style={{ color: "#6b82a0" }} />
              <input type="text" placeholder="Search dishes..." value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#6b82a0]"
                style={{ color: "#e8eef8" }} />
            </div>
            <div ref={catRef} className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {categories.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className="px-4 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 transition-all font-medium"
                  style={activeCategory === cat
                    ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }
                    : { background: "rgba(30,127,255,0.06)", color: "#6b82a0", border: "1px solid rgba(30,127,255,0.1)" }
                  }
                >{cat}</button>
              ))}
            </div>
          </div>

          {/* Menu items */}
          <div className="max-w-2xl mx-auto px-4 py-5 space-y-3 pb-12">
            {categories.filter(c => c !== "All" && (activeCategory === "All" || activeCategory === c)).map(cat => {
              const catItems = filtered.filter(m => m.cat === cat);
              if (catItems.length === 0) return null;
              return (
                <div key={cat}>
                  {activeCategory === "All" && (
                    <h2 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1rem", marginBottom: 12, marginTop: 8 }}>{cat}</h2>
                  )}
                  <div className="space-y-2">
                    {catItems.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-start gap-3 p-3 rounded-2xl"
                        style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.08)" }}
                      >
                        <div
                          className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 text-3xl overflow-hidden"
                          style={{ background: "rgba(30,127,255,0.06)" }}
                        >
                          {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : "🍽"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span style={{ color: "#e8eef8", fontSize: "0.9rem", fontWeight: 600 }}>{item.name}</span>
                                {item.popular && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>★ Popular</span>
                                )}
                              </div>
                              <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginTop: 2, lineHeight: 1.4 }}>{item.description}</p>
                            </div>
                            <span style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "1rem", flexShrink: 0 }}>{cur}{item.price}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && restaurant && (
              <div className="text-center py-12">
                <p style={{ color: "#6b82a0", fontSize: "0.85rem" }}>{search ? `No dishes match "${search}"` : "No items on the menu yet"}</p>
              </div>
            )}
            <div className="text-center pt-6 pb-2 flex flex-col items-center gap-2">
              <p style={{ color: "#6b82a0", fontSize: "0.72rem" }}>Powered by</p>
              <CafyzLogo size="sm" className="opacity-95 mx-auto" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
