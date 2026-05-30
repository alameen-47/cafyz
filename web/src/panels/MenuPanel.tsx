import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { menuApi, type ApiMenuItem } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './MenuPanel.css';

const CATS = [
  { id: 'all',      label: 'All'      },
  { id: 'starters', label: 'Starters' },
  { id: 'mains',    label: 'Mains'    },
  { id: 'desserts', label: 'Desserts' },
  { id: 'wine',     label: 'Wine'     },
  { id: 'drinks',   label: 'Drinks'   },
];

type Draft = {
  name: string; category: string; price: string; description: string;
  symbol: string; is_popular: boolean; is_available: boolean;
};

const blank = (): Draft => ({
  name: '', category: 'mains', price: '', description: '',
  symbol: '○', is_popular: false, is_available: true,
});

/** Module-level form — must NOT be defined inside MenuPanel or inputs lose focus on each keystroke. */
function MenuItemForm({
  formMode,
  editingName,
  draft,
  setDraft,
  error,
  busy,
  onClose,
  onSave,
}: {
  formMode: 'add' | 'edit';
  editingName?: string;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  error: string;
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const isEdit = formMode === 'edit';

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
            {CATS.filter(c => c.id !== 'all').map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="menu-field">
          <label htmlFor="mf-sym">Symbol / Emoji</label>
          <input
            id="mf-sym"
            className="menu-field-input"
            placeholder="e.g. 🍮 or ○"
            value={draft.symbol}
            onChange={e => setDraft(d => ({ ...d, symbol: e.target.value }))}
          />
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

export function MenuPanel() {
  const { user }  = useAuth();
  const canEdit   = user?.role === 'owner' || user?.role === 'manager' || user?.role === 'cashier';

  const [items,   setItems]   = useState<ApiMenuItem[]>([]);
  const [cat,     setCat]     = useState('all');
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState('');

  // formMode: null = closed, 'add' = new item, 'edit' = editing existing
  const [formMode,      setFormMode]      = useState<'add' | 'edit' | null>(null);
  const [editId,        setEditId]        = useState<string | null>(null);
  const [draft,         setDraft]         = useState<Draft>(blank());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    menuApi.list()
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const visible = items
    .filter(i => cat === 'all' || i.category === cat)
    .filter(i => !search.trim() ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.description?.toLowerCase().includes(search.toLowerCase()));

  const catCounts = CATS.map(c => ({
    ...c,
    count: c.id === 'all' ? items.length : items.filter(i => i.category === c.id).length,
  }));

  // ── Open add form ──────────────────────────────────────────────────────────
  function startAdd() {
    setDraft(blank());
    setFormMode('add');
    setEditId(null);
    setConfirmDelete(null);
  }

  // ── Open edit form ─────────────────────────────────────────────────────────
  function startEdit(item: ApiMenuItem) {
    setEditId(item.id);
    setDraft({
      name:         item.name,
      category:     item.category,
      price:        String(item.price),
      description:  item.description ?? '',
      symbol:       item.symbol ?? '○',
      is_popular:   item.is_popular === 1,
      is_available: item.is_available === 1,
    });
    setFormMode('edit');
    setConfirmDelete(null);
    // Scroll form into view
    setTimeout(() => document.getElementById('menu-form-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function closeForm() {
    setFormMode(null);
    setEditId(null);
    setDraft(blank());
  }

  // ── Save add ───────────────────────────────────────────────────────────────
  async function saveAdd() {
    if (!draft.name || !draft.price) return;
    setBusy(true); setError('');
    try {
      const created = await menuApi.create({
        name:         draft.name,
        category:     draft.category,
        price:        parseFloat(draft.price),
        description:  draft.description || undefined,
        symbol:       draft.symbol || '○',
        is_popular:   draft.is_popular,
        is_available: draft.is_available,
      });
      setItems(prev => [...prev, created]);
      closeForm();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  // ── Save edit ──────────────────────────────────────────────────────────────
  async function saveEdit() {
    if (!editId || !draft.name || !draft.price) return;
    setBusy(true); setError('');
    try {
      const updated = await menuApi.update(editId, {
        name:         draft.name,
        category:     draft.category as ApiMenuItem['category'],
        price:        parseFloat(draft.price),
        description:  draft.description,
        symbol:       draft.symbol,
        is_popular:   draft.is_popular,
        is_available: draft.is_available,
      });
      setItems(prev => prev.map(i => i.id === editId ? updated : i));
      closeForm();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
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

  // ── Toggle availability ────────────────────────────────────────────────────
  async function toggleAvailable(item: ApiMenuItem) {
    if (!canEdit) return;
    try {
      const updated = await menuApi.update(item.id, { is_available: item.is_available !== 1 });
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    } catch (e) { setError((e as Error).message); }
  }

  const editingItem = editId ? items.find(i => i.id === editId) : null;
  const formOpen    = formMode !== null;

  if (loading) return (
    <div className="menu-root">
      <p style={{ color: 'var(--text2)', padding: 32 }}>Loading menu…</p>
    </div>
  );

  return (
    <div className="menu-root">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="menu-header">
        <div>
          <p className="eyebrow">Menu · Catalogue</p>
          <h1 className="serif menu-title">Menu Management</h1>
          <p className="menu-sub">
            {items.length} items · {items.filter(i => i.is_available === 1).length} available
          </p>
        </div>
        {canEdit && !formOpen && (
          <div className="menu-header-actions">
            <button className="btn-gold" onClick={startAdd}>+ Add Item</button>
          </div>
        )}
      </div>

      {/* ── Add / Edit form (top, full-width) ───────────────────────────── */}
      {formOpen && formMode && (
        <MenuItemForm
          formMode={formMode}
          editingName={editingItem?.name}
          draft={draft}
          setDraft={setDraft}
          error={error}
          busy={busy}
          onClose={closeForm}
          onSave={formMode === 'edit' ? saveEdit : saveAdd}
        />
      )}

      {/* ── Category filter + search ─────────────────────────────────────── */}
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
      </div>

      {/* ── Item grid ───────────────────────────────────────────────────── */}
      <div className="menu-grid">
        {visible.map(item => (
          <div
            key={item.id}
            className={`menu-item card${item.is_available !== 1 ? ' unavailable' : ''}${editId === item.id ? ' editing' : ''}`}
          >
            {/* Card header */}
            <div className="menu-item-top">
              <span className="menu-item-sym serif">{item.symbol || '○'}</span>
              <div className="menu-item-badges">
                {item.is_popular === 1 && <span className="menu-badge popular">★ Popular</span>}
                <span className={`menu-badge ${item.is_available === 1 ? 'avail' : 'off'}`}>
                  {item.is_available === 1 ? '● On' : '○ Off'}
                </span>
              </div>
            </div>

            {/* Card body */}
            <p className="menu-item-cat eyebrow">{item.category}</p>
            <p className="menu-item-name">{item.name}</p>
            <p className="mono menu-item-price">${item.price.toFixed(2)}</p>
            {item.description && (
              <p className="menu-item-desc">{item.description}</p>
            )}

            {/* Editing indicator */}
            {editId === item.id && (
              <p className="menu-item-editing-note">✏ Editing above ↑</p>
            )}

            {/* Actions */}
            {canEdit && (
              <div className="menu-item-actions">
                <button
                  className="menu-act-edit"
                  onClick={() => editId === item.id ? closeForm() : startEdit(item)}
                  title="Edit this item"
                >
                  {editId === item.id ? '✕ Cancel' : '✏ Edit'}
                </button>
                <button
                  className="menu-act-toggle"
                  onClick={() => toggleAvailable(item)}
                  title={item.is_available === 1 ? 'Mark unavailable' : 'Mark available'}
                >
                  {item.is_available === 1 ? '86 it' : 'Restore'}
                </button>
                {confirmDelete === item.id ? (
                  <div className="menu-act-confirm">
                    <span>Delete?</span>
                    <button className="menu-act-confirm-yes" onClick={() => deleteItem(item.id)} disabled={busy}>
                      {busy ? '…' : 'Yes'}
                    </button>
                    <button className="menu-act-confirm-no" onClick={() => setConfirmDelete(null)}>No</button>
                  </div>
                ) : (
                  <button className="menu-act-delete" onClick={() => setConfirmDelete(item.id)}>Delete</button>
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
