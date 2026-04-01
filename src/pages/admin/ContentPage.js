import React, { useState, useMemo, useCallback } from 'react';
import styles from './ContentPage.module.css';

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = 'adminContent';

const SEED = [
  { id: 'cnt_1', name: 'inmate.state.al', description: 'Alabama prisons information', body: '<h2>Alabama Inmate Search</h2>\n<p>Search for inmates in Alabama state prisons.</p>', updatedAt: '2025-09-01T00:00:00Z' },
  { id: 'cnt_2', name: 'privacy.policy', description: 'Privacy policy details', body: '<h2>Privacy Policy</h2>\n<p>We value your privacy...</p>', updatedAt: '2025-09-01T00:00:00Z' },
  { id: 'cnt_3', name: 'terms.of.use', description: 'Terms of service', body: '<h2>Terms of Use</h2>\n<p>By using this service...</p>', updatedAt: '2025-09-01T00:00:00Z' },
];

function loadContent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [...SEED];
  } catch { return [...SEED]; }
}

function saveContent(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function newId() {
  return `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return iso; }
}

// ─── ContentPage ──────────────────────────────────────────────────────────────

const ContentPage = () => {
  const [items, setItems] = useState(() => loadContent());
  const [tab, setTab] = useState('items'); // 'items' | 'editor'
  const [search, setSearch] = useState('');

  // Editor state
  const [editId, setEditId] = useState(null); // null = new
  const [editorName, setEditorName] = useState('');
  const [editorDesc, setEditorDesc] = useState('');
  const [editorBody, setEditorBody] = useState('');
  const [editorError, setEditorError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return items;
    return items.filter((it) =>
      it.name.toLowerCase().includes(q) ||
      (it.description || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const openNew = () => {
    setEditId(null);
    setEditorName('');
    setEditorDesc('');
    setEditorBody('');
    setEditorError('');
    setTab('editor');
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setEditorName(item.name);
    setEditorDesc(item.description || '');
    setEditorBody(item.body || '');
    setEditorError('');
    setTab('editor');
  };

  const handleSave = () => {
    if (!editorName.trim()) { setEditorError('Name is required.'); return; }
    if (!editorBody.trim()) { setEditorError('Body is required.'); return; }

    let updated;
    if (editId) {
      updated = items.map((it) =>
        it.id === editId
          ? { ...it, name: editorName.trim(), description: editorDesc.trim(), body: editorBody.trim(), updatedAt: new Date().toISOString() }
          : it
      );
      showToast('Content updated.');
    } else {
      const newItem = { id: newId(), name: editorName.trim(), description: editorDesc.trim(), body: editorBody.trim(), updatedAt: new Date().toISOString() };
      updated = [...items, newItem];
      showToast('Content created.');
    }
    saveContent(updated);
    setItems(updated);
    setTab('items');
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this content item?')) return;
    const updated = items.filter((it) => it.id !== id);
    saveContent(updated);
    setItems(updated);
    showToast('Content deleted.');
  };

  return (
    <main className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Content Management</h1>
        <p className={styles.subtitle}>Manage content blocks used across the platform.</p>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'items' ? styles.tabActive : ''}`}
          onClick={() => setTab('items')}
        >
          Items
        </button>
        <button
          className={`${styles.tab} ${tab === 'editor' ? styles.tabActive : ''}`}
          onClick={openNew}
        >
          {editId ? 'Editor' : '+ New'}
        </button>
      </div>

      {/* Items tab */}
      {tab === 'items' && (
        <div className={styles.itemsPanel}>
          <div className={styles.toolbar}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search content…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className={styles.addBtn} onClick={openNew}>+ Add Content</button>
          </div>

          {filtered.length === 0 && (
            <div className={styles.emptyState}>No content items match your search.</div>
          )}

          {filtered.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Name</th>
                    <th className={styles.th}>Description</th>
                    <th className={styles.th}>Updated</th>
                    <th className={styles.th}>Options</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className={styles.tr}>
                      <td className={styles.td}>
                        <code className={styles.itemName}>{item.name}</code>
                      </td>
                      <td className={styles.td}>{item.description || '—'}</td>
                      <td className={styles.td}>{formatDate(item.updatedAt)}</td>
                      <td className={styles.td}>
                        <div className={styles.rowActions}>
                          <button className={styles.editBtn} onClick={() => openEdit(item)}>Edit</button>
                          <button className={styles.deleteBtn} onClick={() => handleDelete(item.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Editor tab */}
      {tab === 'editor' && (
        <div className={styles.editorPanel}>
          <h2 className={styles.editorTitle}>{editId ? 'Edit Content' : 'New Content'}</h2>

          <div className={styles.field}>
            <label className={styles.label}>Name</label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. privacy.policy"
              value={editorName}
              onChange={(e) => setEditorName(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Short description…"
              value={editorDesc}
              onChange={(e) => setEditorDesc(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Body (HTML or Markdown)</label>
            <textarea
              className={styles.textarea}
              rows={12}
              placeholder="Enter HTML or markdown content…"
              value={editorBody}
              onChange={(e) => setEditorBody(e.target.value)}
            />
          </div>

          {editorError && <p className={styles.errorMsg}>{editorError}</p>}

          <div className={styles.editorActions}>
            <button className={styles.cancelBtn} onClick={() => setTab('items')}>Cancel</button>
            <button className={styles.saveBtn} onClick={handleSave}>
              {editId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

export default ContentPage;
