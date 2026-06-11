import { useState, useRef } from "react";
import { motion } from "motion/react";
import { MapPin, Star, Search, Shield } from "lucide-react";

const categories = ["All", "Starters", "Mains", "Biryani", "Desserts", "Drinks"];

const menuItems = [
  { id: "m1", name: "Paneer Tikka", cat: "Starters", price: 14, description: "Marinated cottage cheese cubes grilled in tandoor", popular: true, emoji: "🧀", veg: true },
  { id: "m2", name: "Chicken Wings", cat: "Starters", price: 12, description: "Crispy wings with house BBQ sauce", popular: false, emoji: "🍗", veg: false },
  { id: "m3", name: "Garlic Naan", cat: "Starters", price: 4, description: "Freshly baked tandoor bread with garlic butter", popular: true, emoji: "🫓", veg: true },
  { id: "m4", name: "Butter Chicken", cat: "Mains", price: 18, description: "Creamy tomato gravy with tandoori chicken, served with basmati", popular: true, emoji: "🍛", veg: false },
  { id: "m5", name: "Grilled Salmon", cat: "Mains", price: 28, description: "Atlantic salmon with lemon butter, asparagus & herb potatoes", popular: false, emoji: "🐟", veg: false },
  { id: "m6", name: "Dal Makhani", cat: "Mains", price: 12, description: "Slow-cooked black lentils in rich tomato cream", popular: false, emoji: "🫕", veg: true },
  { id: "m7", name: "Veg Biryani", cat: "Biryani", price: 14, description: "Aromatic basmati layered with seasonal vegetables", popular: false, emoji: "🍚", veg: true },
  { id: "m8", name: "Chicken Biryani", cat: "Biryani", price: 16, description: "Dum-cooked biryani with tender chicken pieces", popular: true, emoji: "🍲", veg: false },
  { id: "m9", name: "Tiramisu", cat: "Desserts", price: 9, description: "Classic Italian ladyfingers, espresso, mascarpone", popular: true, emoji: "🍰", veg: true },
  { id: "m10", name: "Chocolate Lava", cat: "Desserts", price: 8, description: "Warm Belgian chocolate cake with molten center", popular: false, emoji: "🎂", veg: true },
  { id: "m11", name: "Mango Lassi", cat: "Drinks", price: 5, description: "Chilled Alphonso mango with creamy yogurt", popular: true, emoji: "🥭", veg: true },
  { id: "m12", name: "Fresh Lime Soda", cat: "Drinks", price: 4, description: "Freshly squeezed lime with soda water", popular: false, emoji: "🍋", veg: true },
];

export function PublicMenu() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const catRef = useRef<HTMLDivElement>(null);

  const filtered = menuItems.filter(m =>
    (activeCategory === "All" || m.cat === activeCategory) &&
    (search === "" || m.name.toLowerCase().includes(search.toLowerCase()))
  );

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
            className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", boxShadow: "0 0 32px rgba(30,127,255,0.4)" }}
          >
            <Shield size={32} className="text-white" />
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff", fontSize: "1.8rem" }}>The Spice Garden</h1>
          <p style={{ color: "#a8bdd4", marginTop: 4, fontSize: "0.9rem" }}>Authentic Indian & Continental Cuisine</p>
          <div className="flex items-center justify-center gap-4 mt-3">
            <div className="flex items-center gap-1" style={{ color: "#6b82a0", fontSize: "0.78rem" }}>
              <MapPin size={12} /> Koramangala, Bangalore
            </div>
            <div className="flex items-center gap-1" style={{ color: "#f59e0b", fontSize: "0.78rem" }}>
              <Star size={12} fill="#f59e0b" stroke="none" /> 4.7 · 2,400+ reviews
            </div>
          </div>
        </div>
      </div>

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
          const items = filtered.filter(m => m.cat === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              {activeCategory === "All" && (
                <h2 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1rem", marginBottom: 12, marginTop: 8 }}>{cat}</h2>
              )}
              <div className="space-y-2">
                {items.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-start gap-3 p-3 rounded-2xl"
                    style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.08)" }}
                  >
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 text-3xl"
                      style={{ background: "rgba(30,127,255,0.06)" }}
                    >
                      {item.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span style={{ color: "#e8eef8", fontSize: "0.9rem", fontWeight: 600 }}>{item.name}</span>
                            <span className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0"
                              style={{ borderColor: item.veg ? "#22c55e" : "#ff3b5c" }}>
                              <div className="w-2 h-2 rounded-full" style={{ background: item.veg ? "#22c55e" : "#ff3b5c" }} />
                            </span>
                            {item.popular && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>★ Popular</span>
                            )}
                          </div>
                          <p style={{ color: "#6b82a0", fontSize: "0.75rem", marginTop: 2, lineHeight: 1.4 }}>{item.description}</p>
                        </div>
                        <span style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "1rem", flexShrink: 0 }}>₹{item.price}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="text-center pt-6 pb-2">
          <p style={{ color: "#6b82a0", fontSize: "0.72rem" }}>Powered by <span style={{ color: "#1e7fff", fontWeight: 600 }}>CAFYZ</span> · Restaurant OS</p>
        </div>
      </div>
    </div>
  );
}
