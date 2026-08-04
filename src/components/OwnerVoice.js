import React, { useState, useEffect } from 'react';
import { fetchExposureGraph, addOwnerNote, deleteOwnerNote } from '../services/memberEnrichment';

/**
 * "Your Side of the Story" — Owner Voice (docs/product/identity-control-and-owner-voice-spec.md).
 * The identity owner adds context to what's on record about them (the DUI-1996 → "went to rehab in
 * 1997" example). Confirmed-owner-gated server-side; stored labeled as the owner's words, never as fact.
 * A differentiator no broker offers. v1 = capture + owner display; surfacing to viewers on the report
 * (approved-only) is the next step, plugging into the same annotation store.
 */

const GREEN = '#0d5d2f';

export default function OwnerVoice() {
  const [notes, setNotes] = useState([]);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchExposureGraph().then((g) => { if (alive) setNotes(g.annotations || []); });
    return () => { alive = false; };
  }, []);

  const submit = async () => {
    if (!note.trim()) return;
    setBusy(true); setErr('');
    const res = await addOwnerNote({ label: label.trim() || undefined, note: note.trim() });
    setBusy(false);
    if (res && res.moderation && res.moderation.status === 'rejected') {
      // Auto-moderation blocked it (links / contact info / slurs) — tell the owner why, keep the draft.
      setErr(res.moderation.reason || 'That note couldn’t be posted.');
      if (res.annotations) setNotes(res.annotations);
      return;
    }
    if (res && res.annotations) { setNotes(res.annotations); setNote(''); setLabel(''); setOpen(false); }
    else setErr('Couldn’t save. Claim & verify your identity to add your context.');
  };

  const remove = async (id) => {
    const res = await deleteOwnerNote(id);
    if (res && res.annotations) setNotes(res.annotations);
    else setNotes((n) => n.filter((x) => x.id !== id));
  };

  const card = { border: '1px solid #d7ddd9', borderRadius: 14, padding: '20px 22px', background: '#fff', boxShadow: '0 2px 10px rgba(13,93,47,0.06)', marginTop: 16 };
  const input = { border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={card}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>Your Side of the Story</div>
      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>Add context to what's on record about you</p>
      <p style={{ margin: '12px 0 14px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.55 }}>
        A public record is cold, decontextualized data. You're the one person it's about — and the only one who
        can add your side. Your note is <strong>clearly labeled as your words</strong>, never presented as fact.
      </p>

      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ border: '1px solid #e5e7eb', borderLeft: `3px solid ${GREEN}`, borderRadius: 8, padding: '10px 12px', background: '#fafcfb' }}>
              {n.label && <div style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>{n.label}</div>}
              <div style={{ fontSize: 13.5, color: '#1f2937', marginTop: n.label ? 3 : 0, lineHeight: 1.5 }}>{n.note}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>Note from you{n.status === 'pending' ? ' · pending review' : ''}</span>
                <button type="button" onClick={() => remove(n.id)} style={{ fontSize: 11.5, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What's this about? (e.g. a record, an old address)" style={input} />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="Add your context…" style={{ ...input, resize: 'vertical' }} />
          {err && <div style={{ fontSize: 12.5, color: '#b91c1c' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={submit} disabled={busy || !note.trim()} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13.5, fontWeight: 700, cursor: busy || !note.trim() ? 'default' : 'pointer', opacity: busy || !note.trim() ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Add my note'}</button>
            <button type="button" onClick={() => { setOpen(false); setErr(''); }} style={{ background: 'none', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} style={{ background: '#f0fdf4', color: GREEN, border: '1px solid #bbf7d0', borderRadius: 999, padding: '8px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>+ Add your context</button>
      )}
    </div>
  );
}
