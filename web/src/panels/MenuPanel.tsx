import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { menuApi, menuCategoriesApi, ordersApi, tablesApi, type ApiMenuItem, type ApiMenuCategory, type ApiTable } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MenuItemImage } from '../components/MenuItemImage';
import {
  buildMenuCategoryTabs,
  categoryLabelMap,
  defaultCategorySlug,
  slugifyCategoryLabel,
} from '../utils/menuCategories';
import { MENU_IMAGE_ACCEPT, validateMenuImageFile } from '../utils/menuImage';
import { toastBus } from '../services/toastBus';
import { formatMoney } from '../utils/currency';
import './MenuPanel.css';

type Draft = {
  name: string; category: string; price: string; description: string;
  image_url: string; is_popular: boolean; is_available: boolean;
};

type OrderCartItem = { menuItem: ApiMenuItem; qty: number };

const blankItem = (categorySlug: string): Draft => ({
  name: '', category: categorySlug, price: '', description: '',
  image_url: '', is_popular: false, is_available: true,
});

/** Module-level form — must NOT be defined inside MenuPanel or inputs lose focus on each keystroke. */
function MenuItemForm({
  formMode,
  editingName,
  draft,
  setDraft,
  categoryOptions,
  error,
  busy,
  imageUploading,
  imageUploadError,
  onPickImage,
  onRemoveImage,
  onClose,
  onSave,
}: {
  formMode: 'add' | 'edit';
  editingName?: string;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  categoryOptions: ApiMenuCategory[];
  error: string;
  busy: boolean;
  imageUploading: boolean;
  imageUploadError: string;
  onPickImage: (file: File) => void;
  onRemoveImage: () => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const isEdit = formMode === 'edit';
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="menu-form card" id="menu-form-anchor">
      <div className="menu-form-header">
        <div>
          <p className="eyebrow">{isEdit ? 'Editing item' : 'New item'}</p>
          <h3 className="menu-form-title serif">
            {isEdit ? editingName ?? 'Edit item' : 'Add a menu item'}
          </h3>
        </div>
        <button type="button" className="menu-form-close" onClick={onClose} title="Discard">✕</button>
      </div>

      <div className="menu-form-grid">
        <div className="menu-field">
          <label htmlFor="mf-name">Item Name <span className="menu-field-req">*</span></label>
          <input
            id="mf-name"
            className="menu-field-input"
            placeholder="e.g. Soufflé Grand Marnier"
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          />
        </div>

        <div className="menu-field">
          <label htmlFor="mf-price">Price ($) <span className="menu-field-req">*</span></label>
          <input
            id="mf-price"
            className="menu-field-input"
            type="number" min="0" step="0.01"
            placeholder="e.g. 14.50"
            value={draft.price}
            onChange={e => setDraft(d => ({ ...d, price: e.target.value }))}
          />
        </div>

        <div className="menu-field">
          <label htmlFor="mf-cat">Category</label>
          <select
            id="mf-cat"
            className="menu-field-input"
            value={draft.category}
            onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
          >
            {categoryOptions.map(c => (
              <option key={c.id} value={c.slug}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="menu-field menu-image-upload full-width">
          <label htmlFor="mf-image">Item photo</label>
          <div className="menu-image-upload-box">
            <div className="menu-image-preview-wrap">
              <MenuItemImage imageUrl={draft.image_url} name={draft.name || 'Menu item'} variant="menu-card" />
            </div>
            <div className="menu-image-upload-actions">
              <input
                ref={fileRef}
                id="mf-image"
                type="file"
                accept={MENU_IMAGE_ACCEPT}
                hidden
                onChange={e => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) onPickImage(file);
                }}
              />
              <button
                type="button"
                className="btn-outline"
                disabled={busy || imageUploading}
                onClick={() => fileRef.current?.click()}
              >
                {imageUploading ? 'Uploading…' : draft.image_url ? 'Change photo' : 'Upload photo'}
              </button>
              {draft.image_url && (
                <button
                  type="button"
                  className="btn-outline"
                  disabled={busy || imageUploading}
                  onClick={onRemoveImage}
                >
                  Remove photo
                </button>
              )}
              <p className="menu-image-upload-hint">
                JPEG, PNG, WebP, or GIF · max 5 MB · stored on Cloudinary · shown on Menu &amp; POS
              </p>
              {imageUploadError && <p className="menu-image-upload-error">{imageUploadError}</p>}
              {imageUploading && <p className="menu-image-upload-busy">Uploading to Cloudinary…</p>}
            </div>
          </div>
        </div>

        <div className="menu-field full-width">
          <label htmlFor="mf-desc">Description</label>
          <input
            id="mf-desc"
            className="menu-field-input"
            placeholder="Short description shown on POS and receipts…"
            value={draft.description}
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
          />
        </div>

        <div className="menu-form-checks full-width">
          <label className="menu-check-label">
            <input
              type="checkbox"
              checked={draft.is_popular}
              onChange={e => setDraft(d => ({ ...d, is_popular: e.target.checked }))}
            />
            <span className="menu-check-text">
              <strong>★ Mark as Popular</strong>
              <span>Shows a "popular" badge on the POS grid</span>
            </span>
          </label>
          <label className="menu-check-label">
            <input
              type="checkbox"
              checked={draft.is_available}
              onChange={e => setDraft(d => ({ ...d, is_available: e.target.checked }))}
            />
            <span className="menu-check-text">
              <strong>● Available on Menu</strong>
              <span>Uncheck to 86 this item temporarily</span>
            </span>
          </label>
        </div>
      </div>

      <div className="menu-form-footer">
        {error && <p className="menu-form-error">{error}</p>}
        <div className="menu-form-btns">
          <button
            type="button"
            className="btn-gold"
            onClick={onSave}
            disabled={!draft.name || !draft.price || busy}
          >
            {busy ? 'Saving…' : isEdit ? '✓ Save changes' : '+ Add item'}
          </button>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function CategoryManagePanel({
  categories,
  items,
  draftLabel,
  setDraftLabel,
  editId,
  editLabel,
  setEditLabel,
  confirmDeleteId,
  setConfirmDeleteId,
  error,
  busy,
  canDelete,
  onClose,
  onCreate,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  categories: ApiMenuCategory[];
  items: ApiMenuItem[];
  draftLabel: string;
  setDraftLabel: Dispatch<SetStateAction<string>>;
  editId: string | null;
  editLabel: string;
  setEditLabel: Dispatch<SetStateAction<string>>;
  confirmDeleteId: string | null;
  setConfirmDeleteId: Dispatch<SetStateAction<string | null>>;
  error: string;
  busy: boolean;
  canDelete: boolean;
  onClose: () => void;
  onCreate: () => void;
  onStartEdit: (cat: ApiMenuCategory) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (id: string) => void;
}) {
  const slugPreview = slugifyCategoryLabel(draftLabel);

  return (
    <div className="menu-form menu-categories-panel card" id="menu-categories-anchor">
      <div className="menu-form-header">
        <div>
          <p className="eyebrow">Menu · Categories</p>
          <h3 className="menu-form-title serif">Create &amp; manage categories</h3>
          <p className="menu-categories-hint">
            Categories appear in the menu filter and on the POS. Item slugs are used internally (e.g. <span className="mono">small_plates</span>).
          </p>
        </div>
        <button type="button" className="menu-form-close" onClick={onClose} title="Close">✕</button>
      </div>

      <div className="menu-categories-create">
        <div className="menu-field">
          <label htmlFor="mc-label">New category name <span className="menu-field-req">*</span></label>
          <input
            id="mc-label"
            className="menu-field-input"
            placeholder="e.g. Small Plates, Brunch, Cocktails"
            value={draftLabel}
            onChange={e => setDraftLabel(e.target.value)}
          />
          {draftLabel.trim() && (
            <p className="menu-categories-slug-preview mono">ID: {slugPreview}</p>
          )}
        </div>
        <button
          type="button"
          className="btn-gold"
          onClick={onCreate}
          disabled={!draftLabel.trim() || busy}
        >
          {busy ? 'Creating…' : '+ Create Category'}
        </button>
      </div>

      {error && <p className="menu-form-error">{error}</p>}

      <div className="menu-categories-list">
        <p className="eyebrow menu-categories-list-title">Your categories</p>
        {categories.map(cat => {
          const count = items.filter(i => i.category === cat.slug).length;
          const isEditing = editId === cat.id;
          return (
            <div key={cat.id} className="menu-category-row">
              {isEditing ? (
                <>
                  <input
                    className="menu-field-input menu-category-edit-input"
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    aria-label="Category name"
                  />
                  <span className="mono menu-category-slug">{cat.slug}</span>
                  <div className="menu-category-row-actions">
                    <button type="button" className="roles-save-btn sm" onClick={onSaveEdit} disabled={busy || !editLabel.trim()}>
                      {busy ? '…' : 'Save'}
                    </button>
                    <button type="button" className="roles-cancel-btn sm" onClick={onCancelEdit}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="menu-category-row-main">
                    <p className="menu-category-label">{cat.label}</p>
                    <p className="mono menu-category-slug">{cat.slug} · {count} item{count === 1 ? '' : 's'}</p>
                  </div>
                  <div className="menu-category-row-actions">
                    <button type="button" className="roles-edit-btn" onClick={() => onStartEdit(cat)}>Rename</button>
                    {canDelete && (
                      confirmDeleteId === cat.id ? (
                        <>
                          <button type="button" className="roles-del-confirm" onClick={() => onDelete(cat.id)} disabled={busy}>
                            {busy ? '…' : 'Confirm'}
                          </button>
                          <button type="button" className="roles-cancel-btn sm" onClick={() => setConfirmDeleteId(null)}>✕</button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="roles-del-btn"
                          onClick={() => setConfirmDeleteId(cat.id)}
                          disabled={count > 0}
                          title={count > 0 ? 'Move or delete items in this category first' : 'Delete category'}
                        >
                          Delete
                        </button>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MenuPanel() {
  const { user }  = useAuth();
  const canEdit   = user?.role === 'owner' || user?.role === 'manager' || user?.role === 'cashier';
  const canDeleteCategories = user?.role === 'owner' || user?.role === 'manager';
  const canTakeOrderFromMenu =
    user?.role === 'owner' || user?.role === 'manager' || user?.role === 'cashier' || user?.role === 'waiter';

  const [items,      setItems]      = useState<ApiMenuItem[]>([]);
  const [categories, setCategories] = useState<ApiMenuCategory[]>([]);
  const [cat,        setCat]        = useState('all');
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState('');
  const [tables,     setTables]     = useState<ApiTable[]>([]);
  const [orderTable, setOrderTable] = useState('');
  const [orderCart,  setOrderCart]  = useState<OrderCartItem[]>([]);
  const [orderNote,  setOrderNote]  = useState('');
  const [orderBusy,  setOrderBusy]  = useState(false);
  const [orderError, setOrderError] = useState('');

  const [formMode,      setFormMode]      = useState<'add' | 'edit' | null>(null);
  const [editId,        setEditId]        = useState<string | null>(null);
  const [draft,         setDraft]         = useState<Draft>(blankItem('mains'));
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const [categoryDraftLabel, setCategoryDraftLabel] = useState('');
  const [categoryEditId, setCategoryEditId] = useState<string | null>(null);
  const [categoryEditLabel, setCategoryEditLabel] = useState('');
  const [categoryConfirmDelete, setCategoryConfirmDelete] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState('');
  const [categoryBusy, setCategoryBusy] = useState(false);

  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');

  useEffect(() => {
    Promise.all([menuApi.list(), menuCategoriesApi.list(), tablesApi.list()])
      .then(([menuItems, cats, tableRows]) => {
        setItems(menuItems);
        setCategories(cats);
        setTables(tableRows);
        const defaultSlug = defaultCategorySlug(cats);
        setDraft(d => ({ ...d, category: d.category || defaultSlug }));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const labels = categoryLabelMap(categories);
  const catCounts = buildMenuCategoryTabs(categories, items);
  const defaultSlug = defaultCategorySlug(categories);

  const visible = items
    .filter(i => cat === 'all' || i.category === cat)
    .filter(i => !search.trim() ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.description?.toLowerCase().includes(search.toLowerCase()));
  const orderTableObj = tables.find((t) => t.id === orderTable);
  const orderSubtotal = orderCart.reduce((sum, row) => sum + (row.menuItem.price * row.qty), 0);
  const orderQtyMap = Object.fromEntries(orderCart.map((row) => [row.menuItem.id, row.qty]));

  function addOrderItem(item: ApiMenuItem) {
    setOrderCart((prev) => {
      const idx = prev.findIndex((x) => x.menuItem.id === item.id);
      if (idx === -1) return [...prev, { menuItem: item, qty: 1 }];
      const next = [...prev];
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      return next;
    });
  }

  function changeOrderQty(menuItemId: string, delta: number) {
    setOrderCart((prev) =>
      prev
        .map((x) => x.menuItem.id === menuItemId ? { ...x, qty: x.qty + delta } : x)
        .filter((x) => x.qty > 0),
    );
  }

  async function sendOrderFromMenu() {
    if (!orderTable) {
      setOrderError('Please select a table first.');
      return;
    }
    if (orderCart.length === 0) {
      setOrderError('Please add at least one item.');
      return;
    }
    setOrderBusy(true);
    setOrderError('');
    try {
      const order = await ordersApi.create({
        table_id: orderTable,
        covers: orderTableObj?.covers || 2,
        note: orderNote.trim() || undefined,
      });
      for (const row of orderCart) {
        await ordersApi.addItem(order.id, {
          menu_item_id: row.menuItem.id,
          qty: row.qty,
          mods: [],
        });
      }
      await ordersApi.updateStatus(order.id, 'sent');
      await tablesApi.updateStatus(orderTable, { status: 'occupied', course: 'Order sent from Menu' });
      window.dispatchEvent(new CustomEvent('CAFYZ_ORDER_SENT', {
        detail: { tableId: orderTable, orderId: order.id },
      }));
      toastBus.success(`Order sent to kitchen for ${orderTableObj?.name ?? 'selected table'}.`);
      setOrderCart([]);
      setOrderNote('');
    } catch (e) {
      const msg = (e as Error).message;
      setOrderError(msg);
      toastBus.error(`Could not send order: ${msg}`);
    } finally {
      setOrderBusy(false);
    }
  }

  function startAdd() {
    setCategoryPanelOpen(false);
    setDraft(blankItem(defaultSlug));
    setFormMode('add');
    setEditId(null);
    setConfirmDelete(null);
    setError('');
  }

  function openCategoryPanel() {
    setFormMode(null);
    setEditId(null);
    setCategoryPanelOpen(true);
    setCategoryError('');
    setCategoryEditId(null);
    setTimeout(() => document.getElementById('menu-categories-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function closeCategoryPanel() {
    setCategoryPanelOpen(false);
    setCategoryDraftLabel('');
    setCategoryEditId(null);
    setCategoryConfirmDelete(null);
    setCategoryError('');
  }

  function startEdit(item: ApiMenuItem) {
    setCategoryPanelOpen(false);
    setEditId(item.id);
    setDraft({
      name:         item.name,
      category:     item.category,
      price:        String(item.price),
      description:  item.description ?? '',
      image_url:    item.image_url ?? '',
      is_popular:   item.is_popular === 1,
      is_available: item.is_available === 1,
    });
    setFormMode('edit');
    setConfirmDelete(null);
    setImageUploadError('');
    setError('');
    setTimeout(() => document.getElementById('menu-form-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function closeForm() {
    setFormMode(null);
    setEditId(null);
    setDraft(blankItem(defaultSlug));
    setError('');
    setImageUploadError('');
  }

  async function handlePickImage(file: File) {
    const validation = validateMenuImageFile(file);
    if (validation) {
      setImageUploadError(validation);
      return;
    }
    setImageUploading(true);
    setImageUploadError('');
    try {
      const { url } = await menuApi.uploadImage(file);
      setDraft(d => ({ ...d, image_url: url }));
    } catch (e) {
      setImageUploadError((e as Error).message);
    } finally {
      setImageUploading(false);
    }
  }

  function handleRemoveImage() {
    setDraft(d => ({ ...d, image_url: '' }));
    setImageUploadError('');
  }

  async function saveAdd() {
    if (!draft.name || !draft.price) return;
    setBusy(true); setError('');
    try {
      const created = await menuApi.create({
        name:         draft.name,
        category:     draft.category,
        price:        parseFloat(draft.price),
        description:  draft.description || undefined,
        image_url:    draft.image_url || null,
        is_popular:   draft.is_popular,
        is_available: draft.is_available,
      });
      setItems(prev => [...prev, created]);
      closeForm();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function saveEdit() {
    if (!editId || !draft.name || !draft.price) return;
    setBusy(true); setError('');
    try {
      const updated = await menuApi.update(editId, {
        name:         draft.name,
        category:     draft.category,
        price:        parseFloat(draft.price),
        description:  draft.description,
        image_url:    draft.image_url || null,
        is_popular:   draft.is_popular,
        is_available: draft.is_available,
      });
      setItems(prev => prev.map(i => i.id === editId ? updated : i));
      closeForm();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function deleteItem(id: string) {
    setBusy(true); setError('');
    try {
      await menuApi.delete(id);
      setItems(prev => prev.filter(i => i.id !== id));
      setConfirmDelete(null);
      if (editId === id) closeForm();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function toggleAvailable(item: ApiMenuItem) {
    if (!canEdit) return;
    try {
      const updated = await menuApi.update(item.id, { is_available: item.is_available !== 1 });
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    } catch (e) { setError((e as Error).message); }
  }

  async function createCategory() {
    if (!categoryDraftLabel.trim()) return;
    setCategoryBusy(true); setCategoryError('');
    try {
      const created = await menuCategoriesApi.create({ label: categoryDraftLabel.trim() });
      setCategories(prev => [...prev, created].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)));
      setCategoryDraftLabel('');
      setCat(created.slug);
    } catch (e) { setCategoryError((e as Error).message); }
    finally { setCategoryBusy(false); }
  }

  function startCategoryEdit(catRow: ApiMenuCategory) {
    setCategoryEditId(catRow.id);
    setCategoryEditLabel(catRow.label);
    setCategoryConfirmDelete(null);
  }

  async function saveCategoryEdit() {
    if (!categoryEditId || !categoryEditLabel.trim()) return;
    setCategoryBusy(true); setCategoryError('');
    try {
      const updated = await menuCategoriesApi.update(categoryEditId, { label: categoryEditLabel.trim() });
      setCategories(prev => prev.map(c => c.id === categoryEditId ? updated : c));
      setCategoryEditId(null);
    } catch (e) { setCategoryError((e as Error).message); }
    finally { setCategoryBusy(false); }
  }

  async function deleteCategory(id: string) {
    setCategoryBusy(true); setCategoryError('');
    try {
      await menuCategoriesApi.delete(id);
      const removed = categories.find(c => c.id === id);
      setCategories(prev => prev.filter(c => c.id !== id));
      setCategoryConfirmDelete(null);
      if (removed && cat === removed.slug) setCat('all');
    } catch (e) { setCategoryError((e as Error).message); }
    finally { setCategoryBusy(false); }
  }

  const editingItem = editId ? items.find(i => i.id === editId) : null;
  const formOpen = formMode !== null;
  const panelOpen = categoryPanelOpen;

  if (loading) return (
    <div className="menu-root">
      <p style={{ color: 'var(--text2)', padding: 32 }}>Loading menu…</p>
    </div>
  );

  return (
    <div className="menu-root">
      <div className="menu-header">
        <div>
          <p className="eyebrow">Menu · Catalogue</p>
          <h1 className="serif menu-title">Menu Management</h1>
          <p className="menu-sub">
            {items.length} items · {categories.length} categories · {items.filter(i => i.is_available === 1).length} available
          </p>
        </div>
        {canEdit && !formOpen && !panelOpen && (
          <div className="menu-header-actions">
            <button type="button" className="btn-outline" onClick={openCategoryPanel}>+ Categories</button>
            <button type="button" className="btn-gold" onClick={startAdd}>+ Add Item</button>
          </div>
        )}
      </div>

      {panelOpen && (
        <CategoryManagePanel
          categories={categories}
          items={items}
          draftLabel={categoryDraftLabel}
          setDraftLabel={setCategoryDraftLabel}
          editId={categoryEditId}
          editLabel={categoryEditLabel}
          setEditLabel={setCategoryEditLabel}
          confirmDeleteId={categoryConfirmDelete}
          setConfirmDeleteId={setCategoryConfirmDelete}
          error={categoryError}
          busy={categoryBusy}
          canDelete={canDeleteCategories}
          onClose={closeCategoryPanel}
          onCreate={createCategory}
          onStartEdit={startCategoryEdit}
          onCancelEdit={() => { setCategoryEditId(null); setCategoryEditLabel(''); }}
          onSaveEdit={saveCategoryEdit}
          onDelete={deleteCategory}
        />
      )}

      {formOpen && formMode && (
        <MenuItemForm
          formMode={formMode}
          editingName={editingItem?.name}
          draft={draft}
          setDraft={setDraft}
          categoryOptions={categories}
          error={error}
          busy={busy}
          imageUploading={imageUploading}
          imageUploadError={imageUploadError}
          onPickImage={handlePickImage}
          onRemoveImage={handleRemoveImage}
          onClose={closeForm}
          onSave={formMode === 'edit' ? saveEdit : saveAdd}
        />
      )}

      <div className="menu-toolbar">
        {catCounts.map(c => (
          <button key={c.id} type="button"
            className={`pos-pill ${cat === c.id ? 'active' : ''}`}
            onClick={() => setCat(c.id)}
          >
            {c.label}
            {c.count > 0 && <span className="mono">{c.count}</span>}
          </button>
        ))}
        <div className="pos-search">
          <span>🔍</span>
          <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12 }}>
              ✕
            </button>
          )}
        </div>
        {canTakeOrderFromMenu && (
          <div className="menu-order-controls menu-order-controls-inline">
            <select value={orderTable} onChange={(e) => setOrderTable(e.target.value)}>
              <option value="">Select table…</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.status}
                </option>
              ))}
            </select>
            <input
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder="Optional note for kitchen"
            />
            <button type="button" className="btn-gold" onClick={sendOrderFromMenu} disabled={orderBusy || orderCart.length === 0}>
              {orderBusy ? 'Sending…' : 'Send to Kitchen'}
            </button>
          </div>
        )}
      </div>
      {canTakeOrderFromMenu && (
        <div className="menu-order-cart menu-order-cart-inline">
          <p className="eyebrow">Selected Items (click item cards below to add)</p>
          {orderError && <p className="menu-order-error">{orderError}</p>}
          {orderCart.length === 0 ? (
            <p className="menu-order-empty">No items selected yet.</p>
          ) : (
            orderCart.map((row) => (
              <div key={`cart-${row.menuItem.id}`} className="menu-order-cart-row">
                <span>{row.menuItem.name}</span>
                <div className="menu-order-cart-actions">
                  <button type="button" onClick={() => changeOrderQty(row.menuItem.id, -1)}>−</button>
                  <span className="mono">{row.qty}</span>
                  <button type="button" onClick={() => changeOrderQty(row.menuItem.id, 1)}>+</button>
                </div>
              </div>
            ))
          )}
          <div className="menu-order-total">
            <span>Total</span>
            <span className="mono">{formatMoney(orderSubtotal)}</span>
          </div>
        </div>
      )}

      <div className="menu-grid">
        {visible.map(item => (
          <div
            key={item.id}
            className={`menu-item card${item.is_available !== 1 ? ' unavailable' : ''}${editId === item.id ? ' editing' : ''}${canTakeOrderFromMenu && item.is_available === 1 ? ' order-selectable' : ''}${orderQtyMap[item.id] ? ' order-selected' : ''}`}
            role={canTakeOrderFromMenu && item.is_available === 1 ? 'button' : undefined}
            tabIndex={canTakeOrderFromMenu && item.is_available === 1 ? 0 : -1}
            onClick={() => {
              if (canTakeOrderFromMenu && item.is_available === 1) addOrderItem(item);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                if (canTakeOrderFromMenu && item.is_available === 1) {
                  e.preventDefault();
                  addOrderItem(item);
                }
              }
            }}
          >
            <div className="menu-item-top">
              <MenuItemImage imageUrl={item.image_url} name={item.name} variant="menu-card" />
              {orderQtyMap[item.id] ? (
                <span className="menu-order-item-qty mono">× {orderQtyMap[item.id]}</span>
              ) : null}
              <div className="menu-item-badges">
                {item.is_popular === 1 && <span className="menu-badge popular">★ Popular</span>}
                <span className={`menu-badge ${item.is_available === 1 ? 'avail' : 'off'}`}>
                  {item.is_available === 1 ? '● On' : '○ Off'}
                </span>
              </div>
            </div>

            <p className="menu-item-cat eyebrow">{labels[item.category] ?? item.category}</p>
            <p className="menu-item-name">{item.name}</p>
            <p className="mono menu-item-price">{formatMoney(item.price)}</p>
            {item.description && (
              <p className="menu-item-desc">{item.description}</p>
            )}

            {editId === item.id && (
              <p className="menu-item-editing-note">✏ Editing above ↑</p>
            )}

            {canEdit && (
              <div className="menu-item-actions">
                <button
                  className="menu-act-edit"
                  onClick={(e) => { e.stopPropagation(); editId === item.id ? closeForm() : startEdit(item); }}
                  title="Edit this item"
                >
                  {editId === item.id ? '✕ Cancel' : '✏ Edit'}
                </button>
                <button
                  className="menu-act-toggle"
                  onClick={(e) => { e.stopPropagation(); toggleAvailable(item); }}
                  title={item.is_available === 1 ? 'Mark unavailable' : 'Mark available'}
                >
                  {item.is_available === 1 ? '86 it' : 'Restore'}
                </button>
                {confirmDelete === item.id ? (
                  <div className="menu-act-confirm">
                    <span>Delete?</span>
                    <button className="menu-act-confirm-yes" onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} disabled={busy}>
                      {busy ? '…' : 'Yes'}
                    </button>
                    <button className="menu-act-confirm-no" onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}>No</button>
                  </div>
                ) : (
                  <button className="menu-act-delete" onClick={(e) => { e.stopPropagation(); setConfirmDelete(item.id); }}>Delete</button>
                )}
              </div>
            )}
          </div>
        ))}

        {visible.length === 0 && (
          <p style={{ color: 'var(--text3)', padding: 24, gridColumn: '1/-1', fontSize: 13 }}>
            {search ? `No results for "${search}"` : 'No items in this category.'}
          </p>
        )}
      </div>
    </div>
  );
}
