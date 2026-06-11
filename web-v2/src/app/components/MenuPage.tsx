import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Search, Edit2, Trash2, Star, ToggleLeft, ToggleRight, X, Save, ImageIcon, Check } from "lucide-react";
import { toast } from "./Toast";
import { ConfirmModal } from "./ConfirmModal";

const categories = ["All", "Starters", "Mains", "Biryani & Rice", "Desserts", "Drinks", "Specials"];
const itemCategories = ["Starters", "Mains", "Biryani & Rice", "Desserts", "Drinks", "Specials"];

interface MenuItem {
  id: string; name: string; category: string; price: number; description: string;
  rating: number; orders: number; available: boolean; tag?: string;
  image: string; veg: boolean;
}

const initial: MenuItem[] = [
  { id: "m1", name: "Chicken Tikka Masala", category: "Mains",    price: 18, description: "Creamy tomato gravy with tandoori chicken, served with basmati rice",       rating: 4.8, orders: 1240, available: true,  tag: "Bestseller", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300&h=200&fit=crop", veg: false },
  { id: "m2", name: "Margherita Pizza",      category: "Mains",    price: 16, description: "San Marzano tomatoes, fresh mozzarella, basil on stone-baked crust",         rating: 4.6, orders: 890,  available: true,  image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=300&h=200&fit=crop", veg: true },
  { id: "m3", name: "Grilled Salmon",        category: "Mains",    price: 28, description: "Atlantic salmon, lemon butter sauce, asparagus, herb roasted potatoes",      rating: 4.7, orders: 640,  available: true,  tag: "Chef's Pick", image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=300&h=200&fit=crop", veg: false },
  { id: "m4", name: "Paneer Tikka",          category: "Starters", price: 14, description: "Marinated cottage cheese grilled in tandoor with mint chutney",              rating: 4.5, orders: 760,  available: true,  image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=300&h=200&fit=crop", veg: true },
  { id: "m5", name: "Caesar Salad",          category: "Starters", price: 12, description: "Romaine, parmesan, croutons, anchovy dressing",                              rating: 4.3, orders: 420,  available: true,  image: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=300&h=200&fit=crop", veg: false },
  { id: "m6", name: "Veg Biryani",           category: "Biryani & Rice", price: 14, description: "Aromatic basmati rice layered with seasonal vegetables and whole spices", rating: 4.6, orders: 580, available: true, image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=300&h=200&fit=crop", veg: true },
  { id: "m7", name: "Tiramisu",              category: "Desserts", price: 9,  description: "Classic Italian ladyfingers, espresso, mascarpone, dusted cocoa",            rating: 4.9, orders: 520,  available: true,  tag: "Top Rated", image: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=300&h=200&fit=crop", veg: true },
  { id: "m8", name: "Mango Lassi",           category: "Drinks",   price: 5,  description: "Chilled Alphonso mango with creamy yogurt and cardamom",                     rating: 4.7, orders: 950,  available: true,  image: "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=300&h=200&fit=crop", veg: true },
  { id: "m9", name: "Ribeye Steak 300g",     category: "Specials", price: 45, description: "28-day dry-aged US prime cut, chimichurri, truffle fries, roasted garlic",   rating: 4.9, orders: 320,  available: true,  tag: "Premium", image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&h=200&fit=crop", veg: false },
  { id: "m10",name: "Fish & Chips",          category: "Mains",    price: 22, description: "Beer-battered cod, triple-cooked chips, mushy peas and tartare sauce",       rating: 4.4, orders: 480,  available: false, image: "https://images.unsplash.com/photo-1585505808860-6e8e1db42c44?w=300&h=200&fit=crop", veg: false },
  { id: "m11",name: "Chocolate Lava Cake",   category: "Desserts", price: 8,  description: "Warm Belgian chocolate cake with molten center, vanilla ice cream",          rating: 4.8, orders: 610,  available: true,  image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=300&h=200&fit=crop", veg: true },
  { id: "m12",name: "Garlic Naan",           category: "Starters", price: 4,  description: "Freshly baked tandoor bread with garlic butter and coriander",               rating: 4.5, orders: 2100, available: true,  image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&h=200&fit=crop", veg: true },
];

const emptyForm = { name: "", category: "Mains", price: "", description: "", tag: "", veg: true, available: true, image: "" };

function ItemModal({ item, onSave, onClose }: {
  item: Partial<MenuItem> | null;
  onSave: (data: Partial<MenuItem>) => void;
  onClose: () => void;
}) {
  const isEdit = !!item?.id;
  const [form, setForm] = useState({
    name: item?.name || "",
    category: item?.category || "Mains",
    price: item?.price?.toString() || "",
    description: item?.description || "",
    tag: item?.tag || "",
    veg: item?.veg ?? true,
    available: item?.available ?? true,
    image: item?.image || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) e.price = "Enter a valid price";
    if (!form.description.trim()) e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    setSaving(true);
    setTimeout(() => {
      onSave({ ...form, price: Number(form.price) });
      setSaving(false);
    }, 600);
  };

  const Field = ({ label, field, type = "text", placeholder = "" }: { label: string; field: string; type?: string; placeholder?: string }) => (
    <div>
      <label style={{ color: "#a8bdd4", fontSize: "0.75rem", display: "block", marginBottom: 5 }}>{label}</label>
      <input type={type} placeholder={placeholder} value={(form as any)[field]}
        onChange={e => { setForm(f => ({ ...f, [field]: e.target.value })); setErrors(er => ({ ...er, [field]: "" })); }}
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
        style={{
          background: "#111b35", color: "#e8eef8",
          border: `1px solid ${errors[field] ? "rgba(255,59,92,0.4)" : "rgba(30,127,255,0.12)"}`,
        }} />
      {errors[field] && <p style={{ color: "#ff3b5c", fontSize: "0.68rem", marginTop: 3 }}>{errors[field]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(6,9,26,0.88)", backdropFilter: "blur(10px)" }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.2)", maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "rgba(30,127,255,0.1)" }}>
          <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 700 }}>
            {isEdit ? "Edit Item" : "Add Menu Item"}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[rgba(30,127,255,0.08)] transition-all"
            style={{ color: "#6b82a0" }}><X size={16} /></button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-5 space-y-4">
          {/* Image preview */}
          <div className="rounded-2xl overflow-hidden h-36 relative flex items-center justify-center"
            style={{ background: "#111b35", border: "1px dashed rgba(30,127,255,0.2)" }}>
            {form.image ? (
              <img src={form.image} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <ImageIcon size={28} style={{ color: "#6b82a0" }} />
                <p style={{ color: "#6b82a0", fontSize: "0.75rem" }}>Enter image URL below</p>
              </div>
            )}
          </div>
          <Field label="Image URL (optional)" field="image" placeholder="https://images.unsplash.com/..." />

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="Item Name *" field="name" placeholder="Butter Chicken" /></div>
            <div>
              <label style={{ color: "#a8bdd4", fontSize: "0.75rem", display: "block", marginBottom: 5 }}>Category *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }}>
                {itemCategories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <Field label="Price (₹) *" field="price" type="number" placeholder="18" />
          </div>

          <div>
            <label style={{ color: "#a8bdd4", fontSize: "0.75rem", display: "block", marginBottom: 5 }}>Description *</label>
            <textarea value={form.description} onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setErrors(er => ({ ...er, description: "" })); }}
              placeholder="Describe the dish — ingredients, style, accompaniments..."
              rows={3} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
              style={{ background: "#111b35", color: "#e8eef8", border: `1px solid ${errors.description ? "rgba(255,59,92,0.4)" : "rgba(30,127,255,0.12)"}` }} />
            {errors.description && <p style={{ color: "#ff3b5c", fontSize: "0.68rem", marginTop: 3 }}>{errors.description}</p>}
          </div>

          <Field label="Tag (optional)" field="tag" placeholder="Bestseller · Chef's Pick · Popular · New" />

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "#111b35", border: "1px solid rgba(30,127,255,0.08)" }}>
              <span style={{ color: "#a8bdd4", fontSize: "0.82rem" }}>Vegetarian</span>
              <button onClick={() => setForm(f => ({ ...f, veg: !f.veg }))}
                className="w-10 h-5.5 rounded-full relative transition-all"
                style={{ background: form.veg ? "#22c55e" : "rgba(30,127,255,0.12)", width: 40, height: 22 }}>
                <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
                  style={{ left: form.veg ? "calc(100% - 18px)" : 2 }} />
              </button>
            </div>
            <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "#111b35", border: "1px solid rgba(30,127,255,0.08)" }}>
              <span style={{ color: "#a8bdd4", fontSize: "0.82rem" }}>Available</span>
              <button onClick={() => setForm(f => ({ ...f, available: !f.available }))}
                className="rounded-full relative transition-all"
                style={{ background: form.available ? "#1e7fff" : "rgba(30,127,255,0.12)", width: 40, height: 22 }}>
                <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
                  style={{ left: form.available ? "calc(100% - 18px)" : 2 }} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 p-4 border-t flex-shrink-0" style={{ borderColor: "rgba(30,127,255,0.1)" }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(30,127,255,0.06)", color: "#a8bdd4", border: "1px solid rgba(30,127,255,0.1)" }}>
            Cancel
          </button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: saving ? 0.8 : 1 }}>
            {saving
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Save size={14} /> {isEdit ? "Save Changes" : "Add to Menu"}</>}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

export function MenuPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState(initial);
  const [modalItem, setModalItem] = useState<Partial<MenuItem> | null | false>(false); // false=closed, null=new, MenuItem=edit
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const toggleAvailable = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, available: !i.available } : i));
    toast.info(
      `${item.name} ${item.available ? "marked unavailable" : "marked available"}`,
      item.available ? "Hidden from customer menu" : "Now visible to customers"
    );
  };

  const handleSave = (data: Partial<MenuItem>) => {
    const isEdit = !!(modalItem as MenuItem)?.id;
    if (isEdit) {
      setItems(prev => prev.map(i => i.id === (modalItem as MenuItem).id ? { ...i, ...data } : i));
      toast.success("Item updated", `${data.name} has been saved`);
    } else {
      const newItem: MenuItem = {
        id: `m${Date.now()}`,
        rating: 4.5, orders: 0,
        ...(data as any),
        image: data.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=200&fit=crop",
      };
      setItems(prev => [...prev, newItem]);
      toast.success("Item added", `${data.name} is now live on the menu`);
    }
    setModalItem(false);
  };

  const handleDelete = () => {
    const item = items.find(i => i.id === deleteTarget);
    setItems(prev => prev.filter(i => i.id !== deleteTarget));
    setDeleteTarget(null);
    toast.success("Item removed", `${item?.name} has been deleted from the menu`);
  };

  const filtered = items.filter(item =>
    (activeCategory === "All" || item.category === activeCategory) &&
    (search === "" || item.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4">
      {/* Top controls */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 flex-1"
          style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
          <Search size={14} style={{ color: "#6b82a0" }} />
          <input type="text" placeholder="Search menu items..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-[#6b82a0]"
            style={{ color: "#e8eef8" }} />
        </div>
        <motion.button whileTap={{ scale: 0.95 }}
          onClick={() => setModalItem(null)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "white" }}>
          <Plus size={16} /> Add Item
        </motion.button>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className="px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all font-medium flex-shrink-0"
            style={activeCategory === cat
              ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "white" }
              : { background: "#0d1326", color: "#6b82a0", border: "1px solid rgba(30,127,255,0.1)" }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Menu grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl"
          style={{ border: "1px dashed rgba(30,127,255,0.15)" }}>
          <Search size={28} style={{ color: "#6b82a0" }} />
          <p style={{ color: "#6b82a0", fontSize: "0.85rem" }}>No items match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((item, i) => (
              <motion.div key={item.id} layout
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.03 }}
                className="rounded-2xl overflow-hidden transition-all"
                style={{
                  background: "#0d1326",
                  border: "1px solid rgba(30,127,255,0.1)",
                  opacity: item.available ? 1 : 0.6,
                }}>
                {/* Image */}
                <div className="relative h-36 overflow-hidden" style={{ background: "#111b35" }}>
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(13,19,38,0.65) 0%, transparent 55%)" }} />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    {item.tag && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: "rgba(30,127,255,0.85)", color: "white", backdropFilter: "blur(4px)" }}>
                        {item.tag}
                      </span>
                    )}
                    <span className="w-4 h-4 rounded flex items-center justify-center"
                      style={{ background: item.veg ? "rgba(34,197,94,0.9)" : "rgba(255,59,92,0.9)" }}>
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </span>
                  </div>
                  {!item.available && (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: "rgba(6,9,26,0.5)" }}>
                      <span className="text-sm font-semibold px-3 py-1 rounded-full"
                        style={{ background: "rgba(107,130,160,0.25)", color: "#a8bdd4", border: "1px solid rgba(107,130,160,0.3)" }}>
                        Unavailable
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.92rem", lineHeight: 1.3 }}>{item.name}</h4>
                    <span style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.95rem", flexShrink: 0 }}>₹{item.price}</span>
                  </div>
                  <p style={{ color: "#6b82a0", fontSize: "0.73rem", lineHeight: 1.5, marginBottom: 10 }} className="line-clamp-2">{item.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1">
                        <Star size={11} fill="#f59e0b" stroke="none" />
                        <span style={{ color: "#f59e0b", fontSize: "0.72rem", fontWeight: 600 }}>{item.rating}</span>
                      </div>
                      <span style={{ color: "#6b82a0", fontSize: "0.68rem" }}>{item.orders.toLocaleString()} orders</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <motion.button whileTap={{ scale: 0.9 }}
                        onClick={() => setModalItem(item)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[rgba(30,127,255,0.1)] transition-all"
                        style={{ color: "#6b82a0" }}>
                        <Edit2 size={13} />
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.9 }}
                        onClick={() => setDeleteTarget(item.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[rgba(255,59,92,0.1)] transition-all"
                        style={{ color: "#6b82a0" }}>
                        <Trash2 size={13} />
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggleAvailable(item.id)}>
                        {item.available
                          ? <ToggleRight size={22} style={{ color: "#22c55e" }} />
                          : <ToggleLeft size={22} style={{ color: "#6b82a0" }} />}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {modalItem !== false && (
          <ItemModal
            item={modalItem}
            onSave={handleSave}
            onClose={() => setModalItem(false)}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete menu item?"
        message={`"${items.find(i => i.id === deleteTarget)?.name}" will be permanently removed from the menu. This cannot be undone.`}
        confirmLabel="Delete Item"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
