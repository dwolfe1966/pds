import React, { useState, useEffect } from 'react';
import { fetchExposureGraph } from '../services/memberEnrichment';
import InlineOwnerNote from './InlineOwnerNote';

/**
 * Owner Voice, organized by the canonical PROFILE AREAS (owner 2026-08-04) — the person adds their side
 * of the story per area of their record (Locations, Family, Education, …, Data breaches), not per broker
 * or per exposure-score row. Each area carries its own inline note affordance (recordKey `area:<key>`).
 * Confirmed-owner-gated + auto-moderated server-side. Self-contained (fetches its own annotations).
 */

const GREEN = '#0d5d2f';

// Aligned to the canonical section taxonomy (docs/design/profile-concept-model.md §4) + the owner's list.
const AREAS = [
  { key: 'locations', label: 'Locations & address history' },
  { key: 'family', label: 'Family & relatives' },
  { key: 'education', label: 'Education' },
  { key: 'activity', label: 'Work & activity' },
  { key: 'court_criminal', label: 'Court & criminal records' },
  { key: 'property', label: 'Property & assets' },
  { key: 'financial', label: 'Financial records' },
  { key: 'breaches', label: 'Data breaches' },
];

export default function OwnerVoiceAreas() {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchExposureGraph().then((g) => { if (alive) setNotes(g.annotations || []); });
    return () => { alive = false; };
  }, []);

  return (
    <div style={{ border: '1px solid #d7ddd9', borderRadius: 14, padding: '20px 22px', background: '#fff', boxShadow: '0 2px 10px rgba(13,93,47,0.06)', marginTop: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>Your Side of the Story</div>
      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>Add your context to any area of your record</p>
      <p style={{ margin: '12px 0 6px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.55 }}>
        A public record is cold, decontextualized data. You're the one person it's about — add your side,
        area by area. Your note is <strong>clearly labeled as your words</strong>, never presented as fact.
      </p>

      {AREAS.map((a) => (
        <div key={a.key} style={{ borderTop: '1px solid #f0f2f1', padding: '11px 0 8px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{a.label}</div>
          <InlineOwnerNote recordKey={`area:${a.key}`} label={a.label}
            notes={notes.filter((n) => n.record_key === `area:${a.key}`)}
            onChanged={setNotes} indent={0} />
        </div>
      ))}
    </div>
  );
}
