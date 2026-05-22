import { useState, useEffect } from 'react';
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

export function MenuPanel() {
  const { user }  = useAuth();
  const canEdit   = user?.role === 'owner' || user?.role === 'manager' || user?.role === 'cashier';

  const [items,   setItems]   = useState<ApiMenuItem[]>([]);
  const [cat,     setCat]     = useState('all');
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState('');

  const [adding,        setAdding]        = useState(false);
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

  // ── Add ────────────────────────────────────────────────────────────────────
  function startAdd() {
    setDraft(blank());
    setAdding(true);
    setEditId(null);
    setConfirmDelete(null);
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
        symbol:       draft.symbol || '○',
        is_popular:   draft.is_popular,
        is_available: draft.is_available,
      });
      setItems(prev => [...prev, created]);
      setAdding(false);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
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
    setAdding(false);
    setConfirmDelete(null);
  }

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
      setEditId(null);
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
          <p className="menu-sub">{items.length} items · {items.filter(i => i.is_available === 1).length} available</p>
        </div>
        {canEdit && (
          <button className="btn-gold" onClick={startAdd} disabled={busy}>+ Add Item</button>
        )}
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {/* ── Category filter + search ─────────────────────────────────── */}
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

      {/* ── Add form ────────────────────────────────────────────────────── */}
      {adding && (
        <div className="menu-form card">
          <p className="eyebrow" style={{ marginBottom: 12 }}>New item</p>
          <div className="menu-form-grid">
            <input className="roles-input" placeholder="Item name *" value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
            <input className="roles-input" placeholder="Price *" type="number" min="0" step="0.01"
              value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} />
            <select className="roles-select" value={draft.category}
              onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}>
              {CATS.filter(c => c.id !== 'all').map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <input className="roles-input" placeholder="Symbol (emoji or char)" value={draft.symbol}
              onChange={e => setDraft(d => ({ ...d, symbol: e.target.value }))} style={{ width: 80 }} />
            <input className="roles-input" placeholder="Description" value={draft.description}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              style={{ gridColumn: '1 / -1' }} />
            <label className="menu-checkbox">
              <input type="checkbox" checked={draft.is_popular}
                onChange={e => setDraft(d => ({ ...d, is_popular: e.target.checked }))} />
              ★ Popular
            </label>
            <label className="menu-checkbox">
              <input type="checkbox" checked={draft.is_available}
                onChange={e => setDraft(d => ({ ...d, is_available: e.target.checked }))} />
              Available
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="roles-save-btn" onClick={saveAdd}
              disabled={!draft.name || !draft.price || busy}>
              {busy ? 'Saving…' : 'Save item'}
            </button>
            <button className="roles-cancel-btn" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Item grid ───────────────────────────────────────────────────── */}
      <div className="menu-grid">
        {visible.map(item => (
          <div key={item.id} className={`menu-item card ${item.is_available !== 1 ? 'unavailable' : ''}`}>
            {editId === item.id ? (
              /* Inline edit form */
              <div className="menu-item-edit">
                <div className="menu-form-grid">
                  <input className="roles-input" placeholder="Name *" value={draft.name}
                    onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
                  <input className="roles-input" placeholder="Price *" type="number" min="0" step="0.01"
                    value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} />
                  <select className="roles-select" value={draft.category}
                    onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}>
                    {CATS.filter(c => c.id !== 'all').map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                  <input className="roles-input" placeholder="Symbol" value={draft.symbol}
                    onChange={e => setDraft(d => ({ ...d, symbol: e.target.value }))} style={{ width: 80 }} />
                  <input className="roles-input" placeholder="Description" value={draft.description}
                    onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                    style={{ gridColumn: '1 / -1' }} />
                  <label className="menu-checkbox">
                    <input type="checkbox" checked={draft.is_popular}
                      onChange={e => setDraft(d => ({ ...d, is_popular: e.target.checked }))} />
                    ★ Popular
                  </label>
                  <label className="menu-checkbox">
                    <input type="checkbox" checked={draft.is_available}
                      onChange={e => setDraft(d => ({ ...d, is_available: e.target.checked }))} />
                    Available
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button className="roles-save-btn sm" onClick={saveEdit}
                    disabled={!draft.name || !draft.price || busy}>{busy ? '…' : '✓ Save'}</button>
                  <button className="roles-cancel-btn sm" onClick={() => setEditId(null)}>✕</button>
                </div>
              </div>
            ) : (
              /* Display view */
              <>
                <div className="menu-item-top">
                  <span className="menu-item-sym serif">{item.symbol || '○'}</span>
                  <div className="menu-item-badges">
                    {item.is_popular === 1 && <span className="menu-badge popular">★</span>}
                    <span className={`menu-badge ${item.is_available === 1 ? 'avail' : 'off'}`}>
                      {item.is_available === 1 ? '● On' : '○ Off'}
                    </span>
                  </div>
                </div>
                <p className="menu-item-name">{item.name}</p>
                <p className="menu-item-cat eyebrow">{item.category}</p>
                <p className="mono menu-item-price">${item.price.toFixed(2)}</p>
                {item.description && <p className="menu-item-desc">{item.description}</p>}

                {canEdit && (
                  <div className="menu-item-actions">
                    <button className="roles-edit-btn" onClick={() => startEdit(item)}>Edit</button>
                    <button
                      className={`btn-outline`}
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => toggleAvailable(item)}
                      title={item.is_available === 1 ? 'Mark unavailable' : 'Mark available'}
                    >
                      {item.is_available === 1 ? '86 it' : 'Restore'}
                    </button>
                    {confirmDelete === item.id ? (
                      <>
                        <button className="roles-del-confirm" onClick={() => deleteItem(item.id)} disabled={busy}>
                          {busy ? '…' : 'Confirm'}
                        </button>
                        <button className="roles-cancel-btn sm" onClick={() => setConfirmDelete(null)}>✕</button>
                      </>
                    ) : (
                      <button className="roles-del-btn" onClick={() => setConfirmDelete(item.id)}>Delete</button>
                    )}
                  </div>
                )}
              </>
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
