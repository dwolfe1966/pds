import React, { useState } from 'react';
import { saveMemberProfile } from '../services/memberEnrichment';

/**
 * "Complete your profile" card (WSFY Phase 2b, user-provided enrichment). Captures a few
 * self-reported fields — occupation, employer, schools, city — that let us tell members who's
 * searching for them AND how that person might know them ("went to your high school", "a colleague").
 * The schools especially are things public records don't carry. Drop into onboarding or the dashboard.
 *
 * On save → saveMemberProfile() → POST /api/member-enrichment (source 'profile'). Dismissable.
 */
const GREEN = '#0d5d2f';
const GREEN_CTA = '#16a34a';

const field = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db',
  fontSize: 14, marginTop: 4, boxSizing: 'border-box',
};
const label = { fontSize: 12, fontWeight: 700, color: '#374151' };

const LS_DONE = 'wsfyProfileDone';

export default function EnrichProfileCard({ onDone }) {
  const [form, setForm] = useState({ occupation: '', employer: '', highSchool: '', college: '', city: '', state: '' });
  const [saved, setSaved] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(LS_DONE) === '1'; } catch { return false; }
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const hasAny = Object.values(form).some((v) => v && v.trim());

  const submit = (e) => {
    e.preventDefault();
    if (!hasAny) return;
    saveMemberProfile(form);
    try { localStorage.setItem(LS_DONE, '1'); } catch { /* ignore */ }
    setSaved(true);
    if (onDone) onDone();
  };

  // Already completed on this device (and not the just-saved confirmation) → don't nag.
  if (dismissed && !saved) return null;

  if (saved) {
    return (
      <div style={{ background: '#f0fdf4', border: `1px solid ${GREEN_CTA}`, borderRadius: 12, padding: '18px 20px' }}>
        <p style={{ margin: 0, fontWeight: 800, color: '#14532d', fontSize: 15 }}>✓ Thanks — your profile is updated</p>
        <p style={{ margin: '6px 0 0', color: '#166534', fontSize: 13 }}>
          We'll use this to show you who's searching for you and how they might know you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 22px' }}>
      <h3 style={{ margin: 0, fontSize: 17, color: GREEN, fontWeight: 800 }}>Complete your profile</h3>
      <p style={{ margin: '4px 0 16px', color: '#4b5563', fontSize: 13, lineHeight: 1.5 }}>
        Tell us a little about yourself so we can show you who's searching for you — and how they might
        know you (a classmate, a colleague, family). This stays private.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><span style={label}>Occupation</span><input style={field} value={form.occupation} onChange={set('occupation')} placeholder="e.g. Registered Nurse" /></div>
        <div><span style={label}>Employer</span><input style={field} value={form.employer} onChange={set('employer')} placeholder="e.g. Mercy Hospital" /></div>
        <div><span style={label}>High school</span><input style={field} value={form.highSchool} onChange={set('highSchool')} placeholder="e.g. Lincoln High School" /></div>
        <div><span style={label}>College</span><input style={field} value={form.college} onChange={set('college')} placeholder="e.g. UCLA" /></div>
        <div><span style={label}>City</span><input style={field} value={form.city} onChange={set('city')} placeholder="e.g. Los Angeles" /></div>
        <div><span style={label}>State</span><input style={field} value={form.state} onChange={set('state')} placeholder="e.g. CA" maxLength={2} /></div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button type="submit" disabled={!hasAny}
          style={{ background: hasAny ? GREEN_CTA : '#9ca3af', color: '#fff', border: 'none',
            borderRadius: 8, padding: '11px 22px', fontSize: 15, fontWeight: 700, cursor: hasAny ? 'pointer' : 'default' }}>
          Save profile
        </button>
        <button type="button"
          onClick={() => { try { localStorage.setItem(LS_DONE, '1'); } catch { /* ignore */ } setDismissed(true); }}
          style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
          Maybe later
        </button>
      </div>
    </form>
  );
}
