import React, { useState } from 'react';
import { addOwnerNote, deleteOwnerNote } from '../services/memberEnrichment';

/**
 * Inline Owner Voice — "add your side" attached to a SPECIFIC item (a provider row on the footprint, or an
 * attribute/record on the profile/report), not a lump section (owner 2026-08-04). Confirmed-owner-gated +
 * auto-moderated server-side. Pass the item's key (recordKey) + label + the notes already on it; the widget
 * renders those notes and an add affordance, and calls onChanged(annotations) with the fresh full list.
 *
 * <InlineOwnerNote recordKey="spokeo" label="Spokeo" notes={[...]} onChanged={setAnns} />
 */

const GREEN = '#0d5d2f';

export default function InlineOwnerNote({ recordKey, label, notes = [], onChanged, indent = 42 }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr('');
    const res = await addOwnerNote({ recordKey, label, note: text.trim() });
    setBusy(false);
    if (res && res.moderation && res.moderation.status === 'rejected') {
      setErr(res.moderation.reason || 'That note couldn’t be posted.');
      if (res.annotations) onChanged && onChanged(res.annotations);
      return;
    }
    if (res && res.annotations) { onChanged && onChanged(res.annotations); setText(''); setOpen(false); }
    else setErr('Claim & verify your identity to add your context.');
  };

  const remove = async (id) => {
    const res = await deleteOwnerNote(id);
    if (res && res.annotations) onChanged && onChanged(res.annotations);
  };

  return (
    <div style={{ paddingLeft: indent, paddingBottom: notes.length || open ? 6 : 0 }}>
      {notes.map((n) => (
        <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, color: '#374151', lineHeight: 1.45, marginBottom: 3 }}>
          <span style={{ color: GREEN, fontWeight: 800 }} aria-hidden="true">“</span>
          <span style={{ flex: 1 }}>{n.note} <span style={{ color: '#9ca3af', fontSize: 11 }}>— your note{n.status === 'pending' ? ' · pending review' : ''}</span></span>
          <button type="button" onClick={() => remove(n.id)} title="Remove note" style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>
        </div>
      ))}
      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={1000}
            placeholder={`Add your context${label ? ` on ${label}` : ''}…`}
            style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 9px', fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical' }} />
          {err && <div style={{ fontSize: 11.5, color: '#b91c1c' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={submit} disabled={busy || !text.trim()}
              style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: busy || !text.trim() ? 'default' : 'pointer', opacity: busy || !text.trim() ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Add'}</button>
            <button type="button" onClick={() => { setOpen(false); setErr(''); }} style={{ background: 'none', color: '#6b7280', border: 'none', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', color: GREEN, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>＋ Add your side</button>
      )}
    </div>
  );
}
