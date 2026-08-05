import React, { useState, useEffect } from 'react';
import { fetchApprovedNotes } from '../services/memberEnrichment';

/**
 * Owner Voice, VIEWER side — surfaces a person's OWN approved context on their public record/report
 * (the payoff: a viewer sees the subject's side, e.g. "DUI 1996" → "rehab 1997, sober since"). Keyed by
 * the subject's identity (name + state). Renders NOTHING for the vast majority — only the small universe
 * of claimed + verified members who added (auto-approved) UGC. Clearly labeled as the person's own words.
 */

const GREEN = '#0d5d2f';

export default function OwnerNotesOnRecord({ name, state, subjectLabel = 'This person' }) {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    let alive = true;
    if (name) fetchApprovedNotes({ name, state }).then((n) => { if (alive) setNotes(n || []); });
    return () => { alive = false; };
  }, [name, state]);

  if (!notes.length) return null;

  return (
    <div style={{ border: `1px solid #cfe6d6`, borderLeft: `4px solid ${GREEN}`, background: '#f6fbf8', borderRadius: 12, padding: '14px 16px', margin: '12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span aria-hidden="true">💬</span>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: GREEN }}>{subjectLabel} added their side of the story</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notes.map((n) => (
          <div key={n.id}>
            {n.label && <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{n.label}</div>}
            <div style={{ fontSize: 13.5, color: '#1f2937', lineHeight: 1.5, marginTop: n.label ? 2 : 0 }}>
              “{n.note}”
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
        Added by the person this record is about — their own words, not verified fact.
      </div>
    </div>
  );
}
