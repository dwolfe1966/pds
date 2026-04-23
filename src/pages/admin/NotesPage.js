import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './NotesPage.module.css';

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return iso; }
}

function resolveId(item) { return item._id || item.id || ''; }

// Strip basic HTML tags for preview
function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// ─── NoteModal ────────────────────────────────────────────────────────────────

function NoteModal({ note, userId, onSave, onClose, saving }) {
  const [message, setMessage] = useState(note ? stripHtml(note.content?.message || '') : '');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) { setError('Note body is required.'); return; }
    onSave({ message: message.trim(), note });
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
            <label className={styles.label} htmlFor="note-body">Note</label>
            <textarea
              id="note-body"
              className={styles.textarea}
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter note details…"
            />
          </div>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? 'Saving…' : 'Save Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── NoteCard ─────────────────────────────────────────────────────────────────

function NoteCard({ note, onEdit }) {
  const msg = stripHtml(note.content?.message || '');
  const ownerName = note.owner ? `${note.owner.firstName || ''} ${note.owner.lastName || ''}`.trim() : '';

  return (
    <div className={styles.noteCard}>
      <div className={styles.noteHeader}>
        <span className={styles.noteDate}>{formatDate(note.createdAt)}</span>
        {ownerName && <span className={styles.noteAuthor}>by {ownerName}</span>}
      </div>
      <p className={styles.noteBody}>{msg || '(empty note)'}</p>
      <div className={styles.noteActions}>
        <button className={styles.editBtn} onClick={() => onEdit(note)}>Edit</button>
      </div>
    </div>
  );
}

// ─── NotesPage ────────────────────────────────────────────────────────────────

const NotesPage = () => {
  const { token } = useAuth();

  // User search
  const [searchInput, setSearchInput] = useState('');
  const [resolvedUser, setResolvedUser] = useState(null); // { _id, email, firstName, lastName }
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Notes
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noMoreDocs, setNoMoreDocs] = useState(false);
  const [lastId, setLastId] = useState(null);
  const [notesError, setNotesError] = useState('');

  // Modal
  const [editingNote, setEditingNote] = useState(null); // null=closed, undefined=new, note obj=edit
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  // ── user search ────────────────────────────────────────────────────────────

  const handleUserSearch = async (e) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setResolvedUser(null);
    setNotes([]);

    try {
      const res = await api.adminListUsers({ email: q });
      const users = res?.data?.docs ?? res?.docs ?? (Array.isArray(res?.data) ? res.data : []);
      if (users.length === 0) {
        setSearchError(`No user found for "${q}".`);
        return;
      }
      const user = users[0];
      setResolvedUser(user);
      fetchNotes(user._id || user.id, null);
    } catch (err) {
      setSearchError(err.message || 'Failed to find user.');
    } finally {
      setSearching(false);
    }
  };

  // ── load notes ─────────────────────────────────────────────────────────────

  const fetchNotes = async (userId, cursorId) => {
    setLoadingNotes(true);
    setNotesError('');
    try {
      const params = { userId, ...(cursorId ? { lastId: cursorId } : {}) };
      const res = await api.adminFindUserContacts(params);
      const all = (res?.data ?? res?.docs ?? [])
        .filter((d) => d.type === 'userContactAdminNote')
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      // Default view on first page: 10 most-recent notes. Follow-up pages append.
      const docs = cursorId ? all : all.slice(0, 10);
      const last = docs.length > 0 ? resolveId(docs[docs.length - 1]) : null;
      if (cursorId) {
        setNotes((prev) => [...prev, ...docs]);
      } else {
        setNotes(docs);
      }
      setLastId(last);
      setNoMoreDocs(res?.noMoreDocs ?? docs.length === 0);
    } catch (err) {
      setNotesError(err.message || 'Failed to load notes.');
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleLoadMore = () => {
    if (!resolvedUser || loadingNotes || noMoreDocs) return;
    fetchNotes(resolvedUser._id || resolvedUser.id, lastId);
  };

  // ── create / edit note ─────────────────────────────────────────────────────

  const handleSave = async ({ message, note: existingNote }) => {
    if (!resolvedUser) return;
    setSaving(true);
    try {
      if (existingNote) {
        // Update
        await api.adminUpdateNote({ messageId: resolveId(existingNote), message });
        setNotes((prev) =>
          prev.map((n) =>
            resolveId(n) === resolveId(existingNote)
              ? { ...n, content: { ...n.content, message } }
              : n
          )
        );
        showToast('Note updated.');
      } else {
        // Create
        await api.adminCreateNote({ userId: resolvedUser._id || resolvedUser.id, message });
        // Refetch to get server-assigned ID and metadata
        fetchNotes(resolvedUser._id || resolvedUser.id, null);
        showToast('Note created.');
      }
      setEditingNote(null);
    } catch (err) {
      showToast('Error: ' + (err.message || 'Failed to save note.'));
    } finally {
      setSaving(false);
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────

  const userName = resolvedUser
    ? (`${resolvedUser.firstName || ''} ${resolvedUser.lastName || ''}`.trim() || resolvedUser.email || '')
    : '';

  return (
    <main className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      {editingNote !== undefined && editingNote !== null && (
        <NoteModal
          note={editingNote.type ? editingNote : null}
          userId={resolvedUser?._id || resolvedUser?.id}
          onSave={handleSave}
          onClose={() => setEditingNote(null)}
          saving={saving}
        />
      )}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>User Notes</h1>
          <p className={styles.subtitle}>Admin notes attached to customer accounts via BC API.</p>
        </div>
        {resolvedUser && (
          <button className={styles.newBtn} onClick={() => setEditingNote({})}>+ New Note</button>
        )}
      </div>

      {/* User search */}
      <form className={styles.searchForm} onSubmit={handleUserSearch}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by customer email…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button className={styles.searchBtn} type="submit" disabled={searching}>
          {searching ? 'Searching…' : 'Find Customer'}
        </button>
        {resolvedUser && (
          <button type="button" className={styles.clearBtn} onClick={() => {
            setResolvedUser(null); setNotes([]); setSearchInput(''); setSearchError('');
          }}>Clear</button>
        )}
      </form>

      {searchError && <div className={styles.errorMsg}>{searchError}</div>}

      {/* User banner */}
      {resolvedUser && (
        <div className={styles.userBanner}>
          <div>
            <strong>{userName}</strong>
            <span className={styles.userEmail}>{resolvedUser.email}</span>
          </div>
          <Link to={`/users/${resolvedUser._id || resolvedUser.id}`} className={styles.profileLink}>
            View Profile →
          </Link>
        </div>
      )}

      {/* Notes list */}
      {!resolvedUser && !searchError && (
        <div className={styles.emptyState}>
          <p>Search for a customer above to view and add notes.</p>
        </div>
      )}

      {resolvedUser && loadingNotes && notes.length === 0 && (
        <div className={styles.loadingMsg}>Loading notes…</div>
      )}

      {notesError && <div className={styles.errorMsg}>{notesError}</div>}

      {resolvedUser && !loadingNotes && notes.length === 0 && !notesError && (
        <div className={styles.emptyState}>
          <p>No notes yet for this customer. Click <strong>+ New Note</strong> to create the first one.</p>
        </div>
      )}

      <div className={styles.grid}>
        {notes.map((note) => (
          <NoteCard key={resolveId(note)} note={note} onEdit={(n) => setEditingNote(n)} />
        ))}
      </div>

      {resolvedUser && !noMoreDocs && notes.length > 0 && (
        <div className={styles.loadMoreRow}>
          <button className={styles.loadMoreBtn} onClick={handleLoadMore} disabled={loadingNotes}>
            {loadingNotes ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}
    </main>
  );
};

export default NotesPage;
