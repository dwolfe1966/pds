import React, { useState } from 'react';
import styles from './UxManagementPage.module.css';

// ─── localStorage ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'adminUxManagement';

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    configs: [
      { id: 'ux1', name: 'default-private', description: 'Default layout for private records search', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'ux2', name: 'abtest-incentive', description: 'A/B test variant with incentive messaging', createdAt: '2026-02-15T00:00:00Z' },
    ],
    layouts: [
      { id: 'l1', name: 'standard-funnel', description: 'Standard name search → results → signup flow', createdAt: '2026-01-01T00:00:00Z' },
    ],
    collections: [],
    components: [],
  };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function newId() { return `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

// ─── Section ──────────────────────────────────────────────────────────────────

const SECTION_LABELS = {
  configs: 'UX Configs',
  layouts: 'UX Layouts',
  collections: 'UX Collections',
  components: 'UX Components',
};

function Section({ sectionKey, items, onAdd, onEdit, onDelete }) {
  const [open, setOpen] = useState(sectionKey === 'configs');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    onAdd(sectionKey, { id: newId(), name: name.trim(), description: desc.trim(), createdAt: new Date().toISOString() });
    setName(''); setDesc(''); setError('');
  };

  const startEdit = (item) => {
    setEditingId(item.id); setEditName(item.name); setEditDesc(item.description || '');
  };

  const saveEdit = (item) => {
    if (!editName.trim()) return;
    onEdit(sectionKey, { ...item, name: editName.trim(), description: editDesc.trim() });
    setEditingId(null);
  };

  return (
    <div className={styles.section}>
      <button className={styles.sectionHeader} onClick={() => setOpen(!open)}>
        <span className={styles.sectionTitle}>{SECTION_LABELS[sectionKey]}</span>
        <span className={styles.sectionCount}>{items.length}</span>
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.sectionBody}>
          {/* Add form */}
          <form className={styles.addForm} onSubmit={handleAdd}>
            <input
              className={styles.addInput}
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className={styles.addInput}
              placeholder="Description (optional)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <button type="submit" className={styles.addBtn}>Add {SECTION_LABELS[sectionKey].split(' ')[1]}</button>
          </form>
          {error && <p className={styles.errorMsg}>{error}</p>}

          {items.length === 0 ? (
            <div className={styles.emptySection}>No {SECTION_LABELS[sectionKey].toLowerCase()} yet.</div>
          ) : (
            <div className={styles.itemGrid}>
              {items.map((item) => (
                <div key={item.id} className={styles.itemCard}>
                  {editingId === item.id ? (
                    <>
                      <input className={styles.editInput} value={editName} onChange={(e) => setEditName(e.target.value)} />
                      <input className={styles.editInput} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" />
                      <div className={styles.editActions}>
                        <button className={styles.saveEditBtn} onClick={() => saveEdit(item)}>Save</button>
                        <button className={styles.cancelEditBtn} onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.itemName}>{item.name}</div>
                      {item.description && <div className={styles.itemDesc}>{item.description}</div>}
                      <div className={styles.itemFooter}>
                        <button className={styles.editBtn} onClick={() => startEdit(item)}>Edit</button>
                        <button className={styles.deleteBtn} onClick={() => {
                          if (window.confirm(`Delete "${item.name}"?`)) onDelete(sectionKey, item.id);
                        }}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── UxManagementPage ─────────────────────────────────────────────────────────

const UxManagementPage = () => {
  const [data, setData] = useState(() => loadData());
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleAdd = (section, item) => {
    const updated = { ...data, [section]: [item, ...data[section]] };
    saveData(updated); setData(updated); showToast('Item added.');
  };

  const handleEdit = (section, updated) => {
    const next = { ...data, [section]: data[section].map((i) => i.id === updated.id ? updated : i) };
    saveData(next); setData(next); showToast('Item updated.');
  };

  const handleDelete = (section, id) => {
    const next = { ...data, [section]: data[section].filter((i) => i.id !== id) };
    saveData(next); setData(next); showToast('Item deleted.');
  };

  const totalItems = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <main className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>UX Management Dashboard</h1>
        <p className={styles.subtitle}>Expand a section to view and edit its items. {totalItems} item{totalItems !== 1 ? 's' : ''} total.</p>
      </div>

      <div className={styles.sections}>
        {Object.keys(SECTION_LABELS).map((key) => (
          <Section
            key={key}
            sectionKey={key}
            items={data[key]}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </main>
  );
};

export default UxManagementPage;
