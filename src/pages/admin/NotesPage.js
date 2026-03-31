import React, { useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import styles from './NotesPage.module.css';

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = 'adminNotes';

function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function newId() {
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── NoteModal ────────────────────────────────────────────────────────────────

function NoteModal({ note, onSave, onClose }) {
  const [title, setTitle] = useState(note?.title || '');
  const [customer, setCustomer] = useState(note?.customer || '');
  const [body, setBody] = useState(note?.body || '');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!body.trim()) { setError('Note body is required.'); return; }
    onSave({ title: title.trim(), customer: customer.trim(), body: body.trim() });
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{note ? 'Edit Note' : 'New Note'}</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="note-title">Title</label>
            <input
              id="note-title"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Refund Request"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="note-customer">Customer Email (optional)</label>
            <input
              id="note-customer"
              className={styles.input}
              type="email"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="note-body">Note</label>
            <textarea
              id="note-body"
              className={styles.textarea}
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter note details…"
            />
          </div>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.saveBtn}>Save Note</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── NoteCard ─────────────────────────────────────────────────────────────────

function NoteCard({ note, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={styles.noteCard}>
      <div className={styles.noteHeader}>
        <h3 className={styles.noteTitle}>{note.title}</h3>
        <span className={styles.noteDate}>{formatDate(note.createdAt)}</span>
      </div>
      {note.customer && (
        <p className={styles.noteMeta}>
          <strong>Customer:</strong>{' '}
          <Link to={`/admin/users?email=${encodeURIComponent(note.customer)}`} className={styles.noteLink}>
            {note.customer}
          </Link>
        </p>
      )}
      <p className={styles.noteBody}>{note.body}</p>
      <div className={styles.noteActions}>
        <button className={styles.editBtn} onClick={() => onEdit(note)}>Edit</button>
        {confirmDelete ? (
          <>
            <span className={styles.confirmText}>Delete?</span>
            <button className={styles.confirmYes} onClick={() => onDelete(note.id)}>Yes</button>
            <button className={styles.confirmNo} onClick={() => setConfirmDelete(false)}>No</button>
          </>
        ) : (
          <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>Delete</button>
        )}
      </div>
    </div>
  );
}

// ─── NotesPage ────────────────────────────────────────────────────────────────

const NotesPage = () => {
  const [searchParams] = useSearchParams();
  const [notes, setNotes] = useState(() => loadNotes());
  const [search, setSearch] = useState(searchParams.get('customer') || '');
  const [editingNote, setEditingNote] = useState(null);  // null = closed, {} = new, note obj = edit
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return notes;
    return notes.filter((n) =>
      n.title.toLowerCase().includes(q) ||
      (n.customer || '').toLowerCase().includes(q) ||
      n.body.toLowerCase().includes(q)
    );
  }, [notes, search]);

  const handleSave = (fields) => {
    let updated;
    if (editingNote?.id) {
      // Edit existing
      updated = notes.map((n) =>
        n.id === editingNote.id ? { ...n, ...fields, updatedAt: new Date().toISOString() } : n
      );
      showToast('Note updated.');
    } else {
      // New note
      const newNote = {
        id: newId(),
        createdAt: new Date().toISOString(),
        ...fields,
      };
      updated = [newNote, ...notes];
      showToast('Note created.');
    }
    saveNotes(updated);
    setNotes(updated);
    setEditingNote(null);
  };

  const handleDelete = (id) => {
    const updated = notes.filter((n) => n.id !== id);
    saveNotes(updated);
    setNotes(updated);
    showToast('Note deleted.');
  };

  return (
    <main className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      {editingNote !== null && (
        <NoteModal
          note={editingNote.id ? editingNote : null}
          onSave={handleSave}
          onClose={() => setEditingNote(null)}
        />
      )}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Notes Directory</h1>
          <p className={styles.subtitle}>Internal CSR notes linked to customer accounts.</p>
        </div>
        <button className={styles.newBtn} onClick={() => setEditingNote({})}>+ New Note</button>
      </div>

      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by title, customer, or content…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className={styles.clearBtn} onClick={() => setSearch('')}>Clear</button>
        )}
      </div>

      {notes.length === 0 && (
        <div className={styles.emptyState}>
          <p>No notes yet. Click <strong>+ New Note</strong> to create the first one.</p>
        </div>
      )}

      {notes.length > 0 && filtered.length === 0 && (
        <div className={styles.emptyState}>
          <p>No notes match "<strong>{search}</strong>".</p>
        </div>
      )}

      <div className={styles.grid}>
        {filtered.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onEdit={(n) => setEditingNote(n)}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </main>
  );
};

export default NotesPage;
