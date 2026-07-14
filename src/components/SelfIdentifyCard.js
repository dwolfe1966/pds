import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { createReportForIdentity, getReportDetail } from '../services/reportService';
import { enrichFromReport, saveMemberProfile, linkSelfReport } from '../services/memberEnrichment';

/**
 * Self-identification flow (WSFY Phase 2b, report-based enrichment). Pops on the dashboard until the
 * member identifies their own public record:
 *   enter name/location/age → search → (disambiguate if >1) → select "this is me"
 *     → [paid] pull the report on that match NOW (extId is ephemeral — can't store it for later)
 *        → extract occupation/relatives/location → member_enrichment
 *     → add schools (user-provided; records have no education) → member_enrichment
 * So when this member searches someone, WSFY can say "Carol King (works in healthcare) · went to your
 * high school · may be a relative". Independent of BC's ephemeral extId (we enrich at selection time).
 */
const GREEN = '#0d5d2f';
const GREEN_CTA = '#16a34a';
const LS_DONE = 'wsfySelfIdentified';

const field = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginTop: 4, boxSizing: 'border-box' };
const label = { fontSize: 12, fontWeight: 700, color: '#374151' };
const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 22px' };

export default function SelfIdentifyCard() {
  const { user, isPaid } = useAuth();
  const [step, setStep] = useState('form'); // form | searching | choose | working | schools | done
  const [form, setForm] = useState({
    firstName: user?.firstName || '', lastName: user?.lastName || '',
    city: user?.city || '', state: user?.state || '', age: '',
  });
  const [matches, setMatches] = useState([]);
  const [schools, setSchools] = useState({ highSchool: '', college: '' });
  const [err, setErr] = useState('');
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(LS_DONE) === '1'; } catch { return false; } });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const finish = () => { try { localStorage.setItem(LS_DONE, '1'); } catch { /* ignore */ } setDismissed(true); };

  if (dismissed) return null;

  const runSearch = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.firstName.trim() || !form.lastName.trim()) { setErr('Please enter your first and last name.'); return; }
    setStep('searching');
    try {
      const res = await api.searchPeople({
        firstName: form.firstName.trim(), lastName: form.lastName.trim(),
        state: form.state.trim() || undefined, city: form.city.trim() || undefined,
        age: form.age.trim() || undefined, type: 'name', source: 'self-identify',
      });
      const list = (res?.data || []).slice(0, 8);
      setMatches(list);
      setStep('choose');
    } catch {
      setErr("We couldn't run the search right now. You can add your details manually below.");
      setStep('schools');
    }
  };

  const selectMatch = async (m) => {
    setStep('working');
    const selfPerson = { name: m?.fullName, city: m?.city, state: m?.state, age: m?.age || m?.ageRange };
    let enriched = false;
    // Report-based enrichment only for paid members (free can't create reports). Best-effort. The
    // created report's commerceContentId is the CANONICAL, re-fetchable link we store with the member.
    if (isPaid && m?.extId) {
      try {
        const created = await createReportForIdentity(m.extId, m);
        if (created?.success && created.commerceContentId) {
          const report = await getReportDetail(created.commerceContentId);
          if (report?.success !== false) { enrichFromReport(report, selfPerson); enriched = true; }
          else { linkSelfReport(created.commerceContentId, selfPerson); enriched = true; }
        }
      } catch { /* best-effort — fall through to storing the confirmed identity */ }
    }
    // Always store the confirmed identity (stable attrs + location), even without a report.
    if (!enriched) saveMemberProfile({ city: selfPerson.city || form.city, state: selfPerson.state || form.state, selfPerson, source: 'self-identify' });
    setStep('schools');
  };

  const saveSchools = (e) => {
    e.preventDefault();
    if (schools.highSchool.trim() || schools.college.trim()) saveMemberProfile(schools);
    setStep('done');
    finish();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div style={{ ...card, background: '#f0fdf4', borderColor: GREEN_CTA }}>
        <p style={{ margin: 0, fontWeight: 800, color: '#14532d', fontSize: 15 }}>✓ You're all set</p>
        <p style={{ margin: '6px 0 0', color: '#166534', fontSize: 13 }}>We'll use this to show you who's searching for you — and how they might know you.</p>
      </div>
    );
  }

  if (step === 'searching' || step === 'working') {
    return (
      <div style={card}>
        <p style={{ margin: 0, fontWeight: 700, color: GREEN }}>
          {step === 'searching' ? 'Finding your public record…' : 'Getting your details…'}
        </p>
        <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 13 }}>One moment.</p>
      </div>
    );
  }

  if (step === 'choose') {
    return (
      <div style={card}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, color: GREEN, fontWeight: 800 }}>Which one is you?</h3>
        <p style={{ margin: '0 0 14px', color: '#4b5563', fontSize: 13 }}>Select your record so we can personalize who's searching for you.</p>
        {matches.length === 0 && <p style={{ color: '#6b7280', fontSize: 14 }}>No matches found. You can add your details manually.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matches.map((m, i) => (
            <button key={m.extId || i} type="button" onClick={() => selectMatch(m)}
              style={{ textAlign: 'left', background: '#f8faf9', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', cursor: 'pointer' }}>
              <span style={{ fontWeight: 700, color: '#111827' }}>{m.fullName || 'Unknown'}</span>
              <span style={{ color: '#6b7280', fontSize: 13 }}>
                {m.age || m.ageRange ? ` · ${m.age || m.ageRange}` : ''}{m.location ? ` · ${m.location}` : ''}
              </span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 16 }}>
          <button type="button" onClick={() => setStep('schools')} style={{ background: 'none', border: 'none', color: '#374151', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>None of these are me</button>
          <button type="button" onClick={finish} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}>Skip</button>
        </div>
      </div>
    );
  }

  if (step === 'schools') {
    return (
      <form onSubmit={saveSchools} style={card}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, color: GREEN, fontWeight: 800 }}>Add your schools</h3>
        <p style={{ margin: '0 0 14px', color: '#4b5563', fontSize: 13 }}>
          So we can tell you when a classmate is searching for you (public records don't include this).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><span style={label}>High school</span><input style={field} value={schools.highSchool} onChange={(e) => setSchools((s) => ({ ...s, highSchool: e.target.value }))} placeholder="e.g. Lincoln High School" /></div>
          <div><span style={label}>College</span><input style={field} value={schools.college} onChange={(e) => setSchools((s) => ({ ...s, college: e.target.value }))} placeholder="e.g. UCLA" /></div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
          <button type="submit" style={{ background: GREEN_CTA, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Done</button>
          <button type="button" onClick={finish} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Skip</button>
        </div>
      </form>
    );
  }

  // step === 'form'
  return (
    <form onSubmit={runSearch} style={card}>
      <h3 style={{ margin: 0, fontSize: 17, color: GREEN, fontWeight: 800 }}>See who's searching for you</h3>
      <p style={{ margin: '4px 0 16px', color: '#4b5563', fontSize: 13, lineHeight: 1.5 }}>
        Confirm your public record so we can show you who's looking for you — and how they might know you.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><span style={label}>First name</span><input style={field} value={form.firstName} onChange={set('firstName')} /></div>
        <div><span style={label}>Last name</span><input style={field} value={form.lastName} onChange={set('lastName')} /></div>
        <div><span style={label}>City</span><input style={field} value={form.city} onChange={set('city')} placeholder="e.g. Los Angeles" /></div>
        <div><span style={label}>State</span><input style={field} value={form.state} onChange={set('state')} placeholder="CA" maxLength={2} /></div>
        <div><span style={label}>Age</span><input style={field} value={form.age} onChange={set('age')} placeholder="e.g. 42" inputMode="numeric" /></div>
      </div>
      {err && <p style={{ color: '#b91c1c', fontSize: 13, margin: '10px 0 0' }}>{err}</p>}
      <div style={{ marginTop: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
        <button type="submit" style={{ background: GREEN_CTA, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Find my record</button>
        <button type="button" onClick={finish} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Maybe later</button>
      </div>
    </form>
  );
}
