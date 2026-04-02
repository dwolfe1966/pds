import React, { useMemo, useState } from 'react';
import styles from './OffersProductsPage.module.css';

// ─── seed data ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'adminOffersProducts';

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    stocks: [
      { id: 's1', name: 'Standard Access', description: 'Basic search access package', createdAt: '2026-01-01T00:00:00Z' },
      { id: 's2', name: 'Premium Access', description: 'Unlimited search access', createdAt: '2026-01-15T00:00:00Z' },
      { id: 's3', name: 'Trial Access', description: '3-day full access trial', createdAt: '2026-02-01T00:00:00Z' },
    ],
    products: [
      { id: 'p1', name: 'Monthly Plan', stockId: 's1', price: 19.99, description: 'Monthly subscription', createdAt: '2026-01-05T00:00:00Z' },
      { id: 'p2', name: 'Annual Plan', stockId: 's2', price: 149.99, description: 'Annual subscription', createdAt: '2026-01-10T00:00:00Z' },
      { id: 'p3', name: '$1 Trial', stockId: 's3', price: 1.00, description: '3-day trial offer', createdAt: '2026-02-05T00:00:00Z' },
      { id: 'p4', name: 'Monthly Pro', stockId: 's2', price: 29.99, description: 'Monthly premium', createdAt: '2026-02-10T00:00:00Z' },
      { id: 'p5', name: 'Quarterly Plan', stockId: 's1', price: 49.99, description: 'Quarterly subscription', createdAt: '2026-02-15T00:00:00Z' },
      { id: 'p6', name: 'Semi-Annual', stockId: 's2', price: 89.99, description: '6-month subscription', createdAt: '2026-03-01T00:00:00Z' },
      { id: 'p7', name: 'Team Plan', stockId: 's2', price: 199.99, description: '5-seat team plan', createdAt: '2026-03-10T00:00:00Z' },
    ],
    offers: [
      { id: 'o1', name: 'Trial Offer', productId: 'p3', description: 'Homepage trial CTA', supOffer: false },
      { id: 'o2', name: 'Name Search Upsell', productId: 'p1', description: 'Post name-search signup', supOffer: false },
      { id: 'o3', name: 'Phone Search Upsell', productId: 'p1', description: 'Post phone-search signup', supOffer: false },
      { id: 'o4', name: 'Annual Upgrade', productId: 'p2', description: 'In-app upgrade prompt', supOffer: false },
      { id: 'o5', name: 'Incentive A/B Trial', productId: 'p3', description: 'A/B test variant incentive', supOffer: true },
      { id: 'o6', name: 'Exit Intent', productId: 'p3', description: 'Exit-intent popup offer', supOffer: true },
      { id: 'o7', name: 'Email Retention', productId: 'p1', description: 'Churn prevention email link', supOffer: false },
      { id: 'o8', name: 'Partner CPC', productId: 'p5', description: 'Partner traffic landing offer', supOffer: false },
      { id: 'o9', name: 'Pro Upsell', productId: 'p4', description: 'Dashboard upsell prompt', supOffer: false },
      { id: 'o10', name: 'Team Offer', productId: 'p7', description: 'Enterprise sales page', supOffer: false },
      { id: 'o11', name: 'Black Friday Deal', productId: 'p2', description: 'Seasonal promo', supOffer: true },
      { id: 'o12', name: 'Referral Bonus', productId: 'p1', description: 'Referral program offer', supOffer: false },
    ],
  };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({ type, item, data, onSave, onClose }) {
  const [form, setForm] = useState({ ...item });
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name?.trim()) { setError('Name is required.'); return; }
    onSave(type, form);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Edit {type.slice(0, -1)}</h2>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Name</label>
            <input className={styles.input} value={form.name || ''} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <textarea className={styles.textarea} rows={3} value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
          </div>
          {type === 'products' && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Price ($)</label>
                <input className={styles.input} type="number" step="0.01" value={form.price || ''} onChange={(e) => set('price', parseFloat(e.target.value))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Stock</label>
                <select className={styles.select} value={form.stockId || ''} onChange={(e) => set('stockId', e.target.value)}>
                  <option value="">— Select stock —</option>
                  {data.stocks.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </>
          )}
          {type === 'offers' && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Product</label>
                <select className={styles.select} value={form.productId || ''} onChange={(e) => set('productId', e.target.value)}>
                  <option value="">— Select product —</option>
                  {data.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  <input type="checkbox" checked={!!form.supOffer} onChange={(e) => set('supOffer', e.target.checked)} style={{ marginRight: 8 }} />
                  Supplemental Offer
                </label>
              </div>
            </>
          )}
          {error && <p className={styles.errorMsg}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.saveBtn}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── OffersProductsPage ───────────────────────────────────────────────────────

const TYPE_LABELS = { stocks: 'Stocks', products: 'Products', offers: 'Offers' };

const OffersProductsPage = () => {
  const [data, setData] = useState(() => loadData());
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // flatten all items
  const allItems = useMemo(() => {
    const rows = [];
    ['stocks', 'products', 'offers'].forEach((t) => {
      data[t].forEach((item) => rows.push({ ...item, _type: t }));
    });
    return rows;
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (typeFilter !== 'all' && item._type !== typeFilter) return false;
      if (q && !(item.name || '').toLowerCase().includes(q) && !(item.id || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allItems, search, typeFilter]);

  const selected = useMemo(() => {
    if (!selectedId || !selectedType) return null;
    return data[selectedType]?.find((i) => i.id === selectedId) || null;
  }, [data, selectedId, selectedType]);

  const handleSelect = (item) => {
    setSelectedId(item.id);
    setSelectedType(item._type);
  };

  const handleSave = (type, updatedItem) => {
    const updated = {
      ...data,
      [type]: data[type].map((i) => i.id === updatedItem.id ? { ...i, ...updatedItem } : i),
    };
    saveData(updated);
    setData(updated);
    setEditing(false);
    showToast('Saved.');
  };

  // detail fields
  const renderDetail = () => {
    if (!selected) {
      return <div className={styles.detailEmpty}>Select an item from the list to view details.</div>;
    }
    const t = selected._type;
    const stockName = t === 'products' ? data.stocks.find((s) => s.id === selected.stockId)?.name : null;
    const productName = t === 'offers' ? data.products.find((p) => p.id === selected.productId)?.name : null;

    return (
      <>
        <div className={styles.detailHeader}>
          <div>
            <h2 className={styles.detailName}>{selected.name}</h2>
            <span className={styles.typePill}>{TYPE_LABELS[t]?.slice(0, -1)}</span>
          </div>
          <button className={styles.editBtn} onClick={() => setEditing(true)}>Edit Selected</button>
        </div>
        <div className={styles.detailBody}>
          <div className={styles.detailRow}><span className={styles.detailLabel}>ID</span><span className={styles.detailId}>{selected.id}</span></div>
          <div className={styles.detailRow}><span className={styles.detailLabel}>Description</span><span>{selected.description || '—'}</span></div>
          {t === 'products' && (
            <>
              <div className={styles.detailRow}><span className={styles.detailLabel}>Price</span><span>${Number(selected.price || 0).toFixed(2)}</span></div>
              <div className={styles.detailRow}><span className={styles.detailLabel}>Stock</span><span>{stockName || selected.stockId || '—'}</span></div>
            </>
          )}
          {t === 'offers' && (
            <>
              <div className={styles.detailRow}><span className={styles.detailLabel}>Product ID</span><span>{selected.productId || '—'}</span></div>
              <div className={styles.detailRow}><span className={styles.detailLabel}>Product</span><span>{productName || '—'}</span></div>
              <div className={styles.detailRow}><span className={styles.detailLabel}>Supplemental</span><span>{selected.supOffer ? 'Yes' : 'No'}</span></div>
            </>
          )}
          {selected.createdAt && (
            <div className={styles.detailRow}><span className={styles.detailLabel}>Created</span><span>{formatDate(selected.createdAt)}</span></div>
          )}
        </div>
      </>
    );
  };

  return (
    <main className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}
      {editing && selected && (
        <EditModal
          type={selected._type}
          item={selected}
          data={data}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      )}

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Offers & Products</h1>
        <p className={styles.subtitle}>Browse and edit stocks, products, and offer configurations.</p>
      </div>

      {/* Stats */}
      <div className={styles.statsBar}>
        {['stocks', 'products', 'offers'].map((t) => (
          <div key={t} className={`${styles.statCard} ${typeFilter === t ? styles.statCardActive : ''}`} onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)} style={{ cursor: 'pointer' }}>
            <div className={styles.statNumber}>{data[t].length}</div>
            <div className={styles.statLabel}>{TYPE_LABELS[t]}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by name or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={styles.typeSelect} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="stocks">Stocks</option>
          <option value="products">Products</option>
          <option value="offers">Offers</option>
        </select>
      </div>

      {/* Two-column layout */}
      <div className={styles.columns}>
        {/* Item browser */}
        <div className={styles.itemList}>
          <h3 className={styles.columnTitle}>Select Item</h3>
          {filtered.length === 0 ? (
            <div className={styles.emptyList}>No items match your search.</div>
          ) : (
            filtered.map((item) => (
              <button
                key={`${item._type}-${item.id}`}
                className={`${styles.itemRow} ${selectedId === item.id && selectedType === item._type ? styles.itemRowActive : ''}`}
                onClick={() => handleSelect(item)}
              >
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemType}>{TYPE_LABELS[item._type]?.slice(0, -1)}</span>
              </button>
            ))
          )}
        </div>

        {/* Detail panel */}
        <div className={styles.detailPanel}>
          {renderDetail()}
        </div>
      </div>
    </main>
  );
};

export default OffersProductsPage;
