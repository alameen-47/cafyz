import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Search, Edit2, Trash2, Star, ToggleLeft, ToggleRight, X, Save, ImageIcon, Check, Camera, Loader2 } from "lucide-react";
import { toast } from "./Toast";
import { ConfirmModal } from "./ConfirmModal";
import { menuApi, menuCategoriesApi, dashboardApi, type ApiMenuItem, type ApiMenuCategory } from "../../services/api";
import { uploadMenuItemImage } from "../../services/menuImageUpload";
import { MENU_IMAGE_ACCEPT } from "../../utils/menuImage";
import { getCurrencySymbol } from "../../utils/currency";
import { notifyMenuChanged } from "../../utils/menuEvents";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=200&fit=crop";
const VEG_SYMBOL = "🟢";
const NON_VEG_SYMBOL = "🔴";

function vegFromSymbol(symbol?: string): boolean {
  return symbol !== NON_VEG_SYMBOL;
}

function symbolForVeg(veg: boolean): string {
  return veg ? VEG_SYMBOL : NON_VEG_SYMBOL;
}

interface MenuItem {
  id: string; name: string; category: string; price: number; description: string;
  rating?: number; orders: number; available: boolean; isPopular?: boolean;
  image: string; veg?: boolean;
}

// Module scope so a stable identity survives re-renders (otherwise each keystroke
// remounts the input and steals focus).
function Field({ label, value, onChange, error, type = "text", placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; error?: string; type?: string; placeholder?: string }) {
  return (
    <div>
      <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.75rem", display: "block", marginBottom: 5 }}>{label}</label>
      <input type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
        style={{
          background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)",
          border: `1px solid ${error ? "rgba(255,59,92,0.4)" : "rgba(30,127,255,0.12)"}`,
        }} />
      {error && <p style={{ color: "#ff3b5c", fontSize: "0.68rem", marginTop: 3 }}>{error}</p>}
    </div>
  );
}

function ItemModal({ item, itemCategories, onSave, onClose }: {
  item: Partial<MenuItem> | null;
  itemCategories: string[];
  onSave: (data: Partial<MenuItem>) => void;
  onClose: () => void;
}) {
  const isEdit = !!item?.id;
  const cur = getCurrencySymbol();
  const [form, setForm] = useState({
    name: item?.name || "",
    category: item?.category || itemCategories[0] || "Mains",
    price: item?.price?.toString() || "",
    description: item?.description || "",
    isPopular: item?.isPopular ?? false,
    veg: item?.veg ?? true,
    available: item?.available ?? true,
    image: item?.image || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) e.price = "Enter a valid price";
    if (!form.description.trim()) e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await Promise.resolve(onSave({ ...form, price: Number(form.price) }));
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async (file: File) => {
    setImageUploading(true);
    setImageUploadError("");
    try {
      const url = await uploadMenuItemImage(file);
      setForm(f => ({ ...f, image: url }));
      toast.success("Photo uploaded", "Image will appear on the menu and POS");
    } catch (e) {
      const msg = (e as Error).message;
      setImageUploadError(msg);
      toast.error("Upload failed", msg);
    } finally {
      setImageUploading(false);
    }
  };

  const setField = (field: string, v: string) => { setForm(f => ({ ...f, [field]: v })); setErrors(er => ({ ...er, [field]: "" })); };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "var(--cafyz-overlay)", backdropFilter: "blur(10px)" }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--cafyz-surface)", border: "1px solid rgba(30,127,255,0.2)", maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--cafyz-border)" }}>
          <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
            {isEdit ? "Edit Item" : "Add Menu Item"}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[rgba(30,127,255,0.08)] transition-all"
            style={{ color: "var(--cafyz-muted)" }}><X size={16} /></button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-5 space-y-4">
          {/* Image preview + upload */}
          <input ref={fileRef} type="file" accept={MENU_IMAGE_ACCEPT} className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handlePickImage(file);
            }} />
          <div className="rounded-2xl overflow-hidden h-36 relative flex items-center justify-center cursor-pointer"
            style={{ background: "var(--cafyz-surface-2)", border: "1px dashed rgba(30,127,255,0.2)" }}
            onClick={() => !imageUploading && fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
            aria-label="Upload menu item photo">
            {form.image ? (
              <img src={form.image} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <ImageIcon size={28} style={{ color: "var(--cafyz-muted)" }} />
                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem" }}>Upload a photo for this item</p>
              </div>
            )}
            {imageUploading && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: "var(--cafyz-overlay)" }}>
                <Loader2 size={28} className="animate-spin" style={{ color: "#1e7fff" }} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={saving || imageUploading}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "var(--cafyz-border)", color: "#1e7fff", border: "1px solid rgba(30,127,255,0.2)" }}>
              <Camera size={14} /> {form.image ? "Change photo" : "Upload photo"}
            </button>
            {form.image && (
              <button type="button" disabled={saving || imageUploading}
                onClick={() => { setForm(f => ({ ...f, image: "" })); setImageUploadError(""); }}
                className="px-3 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,59,92,0.08)", color: "#ff3b5c", border: "1px solid rgba(255,59,92,0.15)" }}>
                Remove
              </button>
            )}
          </div>
          {imageUploadError && <p style={{ color: "#ff3b5c", fontSize: "0.72rem" }}>{imageUploadError}</p>}
          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.68rem" }}>JPEG, PNG, WebP, GIF, or HEIC · max 8 MB</p>
          <Field label="Or paste image URL (optional)" value={form.image} onChange={v => setField("image", v)} placeholder="https://…" />

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="Item Name *" value={form.name} onChange={v => setField("name", v)} error={errors.name} placeholder="Butter Chicken" /></div>
            <div>
              <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.75rem", display: "block", marginBottom: 5 }}>Category *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }}>
                {itemCategories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <Field label={`Price (${cur}) *`} value={form.price} onChange={v => setField("price", v)} error={errors.price} type="number" placeholder="18" />
          </div>

          <div>
            <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.75rem", display: "block", marginBottom: 5 }}>Description *</label>
            <textarea value={form.description} onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setErrors(er => ({ ...er, description: "" })); }}
              placeholder="Describe the dish — ingredients, style, accompaniments..."
              rows={3} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
              style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: `1px solid ${errors.description ? "rgba(255,59,92,0.4)" : "rgba(30,127,255,0.12)"}` }} />
            {errors.description && <p style={{ color: "#ff3b5c", fontSize: "0.68rem", marginTop: 3 }}>{errors.description}</p>}
          </div>

          <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "var(--cafyz-surface-2)", border: "1px solid rgba(30,127,255,0.08)" }}>
            <span style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.82rem" }}>Mark as popular</span>
            <button type="button" onClick={() => setForm(f => ({ ...f, isPopular: !f.isPopular }))}
              className="rounded-full relative transition-all"
              style={{ background: form.isPopular ? "#f59e0b" : "rgba(30,127,255,0.12)", width: 40, height: 22 }}>
              <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
                style={{ left: form.isPopular ? "calc(100% - 18px)" : 2 }} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "var(--cafyz-surface-2)", border: "1px solid rgba(30,127,255,0.08)" }}>
              <span style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.82rem" }}>Vegetarian</span>
              <button onClick={() => setForm(f => ({ ...f, veg: !f.veg }))}
                className="w-10 h-5.5 rounded-full relative transition-all"
                style={{ background: form.veg ? "#22c55e" : "rgba(30,127,255,0.12)", width: 40, height: 22 }}>
                <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
                  style={{ left: form.veg ? "calc(100% - 18px)" : 2 }} />
              </button>
            </div>
            <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "var(--cafyz-surface-2)", border: "1px solid rgba(30,127,255,0.08)" }}>
              <span style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.82rem" }}>Available</span>
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
        <div className="flex gap-2.5 p-4 border-t flex-shrink-0" style={{ borderColor: "var(--cafyz-border)" }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(30,127,255,0.06)", color: "var(--cafyz-text-secondary)", border: "1px solid var(--cafyz-border)" }}>
            Cancel
          </button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleSave} disabled={saving || imageUploading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: saving || imageUploading ? 0.8 : 1 }}>
            {saving || imageUploading
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
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cats, setCats] = useState<ApiMenuCategory[]>([]);
  const [modalItem, setModalItem] = useState<Partial<MenuItem> | null | false>(false); // false=closed, null=new, MenuItem=edit
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const cur = getCurrencySymbol();
  const slugByLabel = new Map(cats.map(c => [c.label, c.slug]));
  const categories = ["All", ...cats.map(c => c.label)];
  const itemCategories = cats.map(c => c.label);

  const mapItem = useCallback((m: ApiMenuItem, soldQty: Map<string, number>, labels: Map<string, string>): MenuItem => ({
    id: m.id,
    name: m.name,
    category: labels.get(m.category) ?? m.category,
    price: m.price,
    description: m.description ?? "",
    available: m.is_available === 1,
    isPopular: m.is_popular === 1,
    image: m.image_url ?? "",
    veg: vegFromSymbol(m.symbol),
    orders: soldQty.get(m.id) ?? 0,
  }), []);

  const load = useCallback(async () => {
    try {
      const [menu, categoryRows, sold] = await Promise.all([
        menuApi.list(undefined, { all: true }),   // management view incl. 86'd items
        menuCategoriesApi.list(),
        dashboardApi.soldItems({ period: "month" }).catch(() => null),
      ]);
      const labels = new Map(categoryRows.map(c => [c.slug, c.label]));
      const soldQty = new Map<string, number>();
      for (const day of sold?.days ?? []) for (const it of day.items) {
        soldQty.set(it.menu_item_id, (soldQty.get(it.menu_item_id) ?? 0) + it.qty_sold);
      }
      setCats(categoryRows);
      setItems(menu.map(m => mapItem(m, soldQty, labels)));
    } catch (e) {
      toast.error("Couldn't load menu", (e as Error).message);
    }
  }, [mapItem]);
  useEffect(() => { void load(); }, [load]);

  const toggleAvailable = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, available: !i.available } : i));
    toast.info(
      `${item.name} ${item.available ? "marked unavailable" : "marked available"}`,
      item.available ? "Hidden from customer menu" : "Now visible to customers"
    );
    try {
      await menuApi.update(id, { is_available: !item.available });
      notifyMenuChanged();
    } catch (e) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, available: item.available } : i));
      toast.error("Couldn't update availability", (e as Error).message);
    }
  };

  const handleSave = async (data: Partial<MenuItem>) => {
    const editId = (modalItem as MenuItem)?.id;
    const payload = {
      name: data.name ?? "",
      category: slugByLabel.get(data.category ?? "") ?? cats[0]?.slug ?? "mains",
      price: Number(data.price) || 0,
      description: data.description ?? "",
      image_url: data.image?.trim() ? data.image.trim() : null,
      is_popular: !!data.isPopular,
      symbol: symbolForVeg(data.veg ?? true),
      is_available: data.available ?? true,
    };
    try {
      if (editId) {
        await menuApi.update(editId, payload);
        toast.success("Item updated", `${data.name} has been saved`);
      } else {
        await menuApi.create(payload);
        toast.success("Item added", `${data.name} is now live on the menu`);
      }
      setModalItem(false);
      await load();
      notifyMenuChanged();
    } catch (e) {
      toast.error("Couldn't save item", (e as Error).message);
    }
  };

  const handleDelete = async () => {
    const item = items.find(i => i.id === deleteTarget);
    const id = deleteTarget;
    setDeleteTarget(null);
    if (!id) return;
    try {
      await menuApi.delete(id);
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success("Item removed", `${item?.name} has been deleted from the menu`);
      notifyMenuChanged();
    } catch (e) {
      toast.error("Couldn't delete item", (e as Error).message);
    }
  };

  const addCategory = async () => {
    const label = newCategory.trim();
    if (!label) { toast.error("Category name required"); return; }
    try {
      await menuCategoriesApi.create({ label });
      toast.success("Category added", label);
      setNewCategory("");
      setShowCategoryForm(false);
      await load();
      notifyMenuChanged();
    } catch (e) {
      toast.error("Couldn't add category", (e as Error).message);
    }
  };

  const renameCategory = async (cat: ApiMenuCategory) => {
    const label = window.prompt(`Rename category "${cat.label}"`, cat.label)?.trim();
    if (!label || label === cat.label) return;
    try {
      await menuCategoriesApi.update(cat.id, { label });
      toast.success("Category renamed", label);
      if (activeCategory === cat.label) setActiveCategory(label);
      await load();
      notifyMenuChanged();
    } catch (e) {
      toast.error("Couldn't rename category", (e as Error).message);
    }
  };

  const removeCategory = async (cat: ApiMenuCategory) => {
    if (!window.confirm(`Delete category "${cat.label}"? Items keep their slug until reassigned.`)) return;
    try {
      await menuCategoriesApi.delete(cat.id);
      toast.success("Category removed", cat.label);
      if (activeCategory === cat.label) setActiveCategory("All");
      await load();
      notifyMenuChanged();
    } catch (e) {
      toast.error("Couldn't delete category", (e as Error).message);
    }
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
          style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
          <Search size={14} style={{ color: "var(--cafyz-muted)" }} />
          <input type="text" placeholder="Search menu items..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-[var(--cafyz-muted)]"
            style={{ color: "var(--cafyz-text)" }} />
        </div>
        <motion.button whileTap={{ scale: 0.95 }}
          onClick={() => setShowCategoryForm(v => !v)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0"
          style={{ background: "rgba(30,127,255,0.08)", color: "#1e7fff", border: "1px solid rgba(30,127,255,0.15)" }}>
          <Plus size={16} /> Category
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }}
          onClick={() => setModalItem(null)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "white" }}>
          <Plus size={16} /> Add Item
        </motion.button>
      </div>

      {showCategoryForm && (
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center rounded-xl p-3"
          style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
          <input type="text" placeholder="New category name" value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none placeholder:text-[var(--cafyz-muted)]"
            style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
          <button onClick={() => void addCategory()}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
            Add Category
          </button>
        </div>
      )}

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map(cat => (
          <div key={cat} className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setActiveCategory(cat)}
              className="px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all font-medium"
              style={activeCategory === cat
                ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "white" }
                : { background: "var(--cafyz-surface)", color: "var(--cafyz-muted)", border: "1px solid var(--cafyz-border)" }}>
              {cat}
            </button>
            {cat !== "All" && (() => {
              const row = cats.find(c => c.label === cat);
              if (!row) return null;
              return (
                <>
                  <button onClick={() => void renameCategory(row)} title={`Rename ${cat}`}
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(30,127,255,0.08)", color: "#1e7fff" }}>
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => void removeCategory(row)} title={`Delete ${cat}`}
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,59,92,0.08)", color: "#ff3b5c" }}>
                    ×
                  </button>
                </>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Menu grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl"
          style={{ border: "1px dashed rgba(30,127,255,0.15)" }}>
          <Search size={28} style={{ color: "var(--cafyz-muted)" }} />
          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.85rem" }}>No items match your search</p>
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
                  background: "var(--cafyz-surface)",
                  border: "1px solid var(--cafyz-border)",
                  opacity: item.available ? 1 : 0.6,
                }}>
                {/* Image */}
                <div className="relative h-36 overflow-hidden" style={{ background: "var(--cafyz-surface-2)" }}>
                  <img src={item.image || FALLBACK_IMG} alt={item.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(13,19,38,0.65) 0%, transparent 55%)" }} />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    {item.isPopular && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: "rgba(30,127,255,0.85)", color: "white", backdropFilter: "blur(4px)" }}>
                        Popular
                      </span>
                    )}
                    {item.veg !== undefined && (
                      <span className="w-4 h-4 rounded flex items-center justify-center"
                        style={{ background: item.veg ? "rgba(34,197,94,0.9)" : "rgba(255,59,92,0.9)" }}>
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </span>
                    )}
                  </div>
                  {!item.available && (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: "var(--cafyz-overlay)" }}>
                      <span className="text-sm font-semibold px-3 py-1 rounded-full"
                        style={{ background: "rgba(107,130,160,0.25)", color: "var(--cafyz-text-secondary)", border: "1px solid rgba(107,130,160,0.3)" }}>
                        Unavailable
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.92rem", lineHeight: 1.3 }}>{item.name}</h4>
                    <span style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.95rem", flexShrink: 0 }}>{cur}{item.price}</span>
                  </div>
                  <p style={{ color: "var(--cafyz-muted)", fontSize: "0.73rem", lineHeight: 1.5, marginBottom: 10 }} className="line-clamp-2">{item.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {item.rating != null && (
                        <div className="flex items-center gap-1">
                          <Star size={11} fill="#f59e0b" stroke="none" />
                          <span style={{ color: "#f59e0b", fontSize: "0.72rem", fontWeight: 600 }}>{item.rating}</span>
                        </div>
                      )}
                      <span style={{ color: "var(--cafyz-muted)", fontSize: "0.68rem" }}>{item.orders.toLocaleString()} sold</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <motion.button whileTap={{ scale: 0.9 }}
                        onClick={() => setModalItem(item)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--cafyz-border)] transition-all"
                        style={{ color: "var(--cafyz-muted)" }}>
                        <Edit2 size={13} />
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.9 }}
                        onClick={() => setDeleteTarget(item.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[rgba(255,59,92,0.1)] transition-all"
                        style={{ color: "var(--cafyz-muted)" }}>
                        <Trash2 size={13} />
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggleAvailable(item.id)}>
                        {item.available
                          ? <ToggleRight size={22} style={{ color: "#22c55e" }} />
                          : <ToggleLeft size={22} style={{ color: "var(--cafyz-muted)" }} />}
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
            itemCategories={itemCategories}
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
