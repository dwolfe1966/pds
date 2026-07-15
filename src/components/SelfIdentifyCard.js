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
const GREEN_CTA = '#0d5d2f'; // primary CTA = dark green (no light green for CTAs, owner)
const LS_DONE = 'wsfySelfIdentified';

const field = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginTop: 4, boxSizing: 'border-box' };
const label = { fontSize: 12, fontWeight: 700, color: '#374151' };
const card = { background: '#fff', border: '1px solid #d7ddd9', borderRadius: 12, padding: '20px 22px', boxShadow: '0 4px 18px rgba(13,93,47,0.12)' };

// The BC teaser runs on name+state (apiRouter strips city/age — the un-strip is a separate,
// tested change). So narrow the returned matches by city/age CLIENT-SIDE for disambiguation.
// Soft filter: if a criterion empties the list, keep the pre-filter set (never hide the real match).
function narrowMatches(list, { city, age }) {
  let out = Array.isArray(list) ? list : [];
  if (city && city.trim()) {
    const c = city.trim().toLowerCase();
    const byCity = out.filter((m) => `${m.location || ''} ${m.city || ''}`.toLowerCase().includes(c));
    if (byCity.length) out = byCity;
  }
  if (age && String(age).trim()) {
    const a = parseInt(String(age), 10);
    if (!Number.isNaN(a)) {
      const byAge = out.filter((m) => {
        const ma = parseInt((String(m.age || m.ageRange || '').match(/\d+/) || [])[0] || '', 10);
        return !Number.isNaN(ma) && Math.abs(ma - a) <= 3;
      });
      if (byAge.length) out = byAge;
    }
  }
  return out;
}

export default function SelfIdentifyCard({ forceShow = false, onComplete } = {}) {
  const { user, isPaid } = useAuth();
  const [step, setStep] = useState('form'); // form | searching | choose | working | schools | done
  const [form, setForm] = useState({
    firstName: user?.firstName || '', middleName: '', lastName: user?.lastName || '',
    city: user?.city || '', state: user?.state || '', age: '',
  });
  const [matches, setMatches] = useState([]);
  const [allFetched, setAllFetched] = useState([]);
  const [rawResp, setRawResp] = useState(null);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const [showingAll, setShowingAll] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [schools, setSchools] = useState({ highSchool: '', college: '' });
  const [err, setErr] = useState('');
  const [recordConfirmed, setRecordConfirmed] = useState(false);
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(LS_DONE) === '1'; } catch { return false; } });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  // Session-only hide (reappears next dashboard visit) — Skip / Maybe later / None-of-these.
  const hideForNow = () => { setDismissed(true); if (onComplete) onComplete(); };
  // PERMANENT dismiss — only when the member actually confirms a record (owner: don't let the
  // module go away until they select a record).
  const confirmDone = () => { try { localStorage.setItem(LS_DONE, '1'); } catch { /* ignore */ } setStep('done'); if (onComplete) onComplete(); };

  if (dismissed && !forceShow) return null;

  const runSearch = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.firstName.trim() || !form.lastName.trim()) { setErr('Please enter your first and last name.'); return; }
    setStep('searching');
    try {
      const res = await api.searchPeople({
        firstName: form.firstName.trim(), lastName: form.lastName.trim(),
        middleName: form.middleName.trim() || undefined,
        state: form.state.trim() || undefined, city: form.city.trim() || undefined,
        age: form.age.trim() || undefined, type: 'name', source: 'self-identify',
      });
      const all = res?.data || [];
      setAllFetched(all);
      setMatches(narrowMatches(all, form));
      setRawResp(res?.rawResponse || null);
      setCanLoadMore(!!(res?.pagination && res.pagination.hasMore));
      setShowingAll(false);
      setExhausted(false);
      setStep('choose');
    } catch {
      setErr("We couldn't run the search right now. You can add your details manually below.");
      setStep('schools');
    }
  };

  // "None of these are me" → surface MORE of the result set before giving up: first reveal any
  // matches the client-side age filter hid, then paginate BC for the next page. Exhausted → refine.
  const showMore = async () => {
    if (!showingAll && allFetched.length > matches.length) {
      setMatches(allFetched);
      setShowingAll(true);
      return;
    }
    if (canLoadMore && rawResp) {
      setLoadingMore(true);
      try {
        const more = await api.loadMoreSearchResults(rawResp);
        const newData = more?.data || [];
        if (newData.length) {
          const merged = [...allFetched, ...newData];
          setAllFetched(merged);
          setMatches(merged);
          setShowingAll(true);
          setRawResp(more.rawResponse || rawResp);
          setCanLoadMore(!!(more.pagination && more.pagination.hasMore));
        } else { setCanLoadMore(false); setExhausted(true); }
      } catch { setCanLoadMore(false); setExhausted(true); }
      setLoadingMore(false);
      return;
    }
    setExhausted(true); // nothing more to load — offer refine / schools
  };

  const selectMatch = async (m) => {
    setRecordConfirmed(true); // a real record was selected → this run can permanently dismiss
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
    // Always show the confirmation. Permanent dismiss ONLY if they confirmed a real record; the
    // "none of these" path shows the confirmation but the module returns next visit (LS_DONE unset).
    if (recordConfirmed) { try { localStorage.setItem(LS_DONE, '1'); } catch { /* ignore */ } }
    setStep('done');
    if (onComplete) onComplete();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (step === 'done') {
    const added = [schools.highSchool.trim() && 'high school', schools.college.trim() && 'college'].filter(Boolean);
    return (
      <div style={{ ...card, background: '#f0fdf4', borderColor: GREEN_CTA }}>
        <p style={{ margin: 0, fontWeight: 800, color: '#14532d', fontSize: 15 }}>
          ✓ {recordConfirmed ? "We've successfully mapped your identity" : 'Details saved'}
        </p>
        <p style={{ margin: '6px 0 0', color: '#166534', fontSize: 13, lineHeight: 1.5 }}>
          {recordConfirmed
            ? `We've linked your public record${added.length ? ` and saved your ${added.join(' and ')}` : ''}. We'll use this to show you who's searching for you — and how they might know you.`
            : `We've saved your ${added.length ? added.join(' and ') : 'details'}. Confirm your record to fully map your identity and unlock who's searching for you.`}
        </p>
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
        <p style={{ margin: '0 0 14px', color: '#4b5563', fontSize: 13 }}>Select your record to confirm your identity.</p>
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
        <div style={{ marginTop: 14, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {!exhausted && (matches.length > 0 || canLoadMore) && (
            <button type="button" onClick={showMore} disabled={loadingMore}
              style={{ background: 'none', border: 'none', color: GREEN_CTA, fontSize: 13, fontWeight: 700, cursor: loadingMore ? 'default' : 'pointer', textDecoration: 'underline' }}>
              {loadingMore ? 'Loading…' : 'None of these are me — show more results'}
            </button>
          )}
          <button type="button" onClick={() => setStep('form')}
            style={{ background: 'none', border: 'none', color: '#374151', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
            Refine my search
          </button>
          {exhausted && (
            <button type="button" onClick={() => setStep('schools')}
              style={{ background: 'none', border: 'none', color: '#374151', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
              Add my schools instead
            </button>
          )}
          <button type="button" onClick={hideForNow} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}>Skip</button>
        </div>
        {exhausted && (
          <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#6b7280' }}>
            That's all we found. Try <strong>Refine my search</strong> with your middle name, a different city, or your age to narrow it down.
          </p>
        )}
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
          <button type="button" onClick={() => (recordConfirmed ? confirmDone() : hideForNow())} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Skip</button>
        </div>
      </form>
    );
  }

  // step === 'form'
  return (
    <form onSubmit={runSearch} style={card}>
      <h3 style={{ margin: 0, fontSize: 17, color: GREEN, fontWeight: 800 }}>Confirm my Identity</h3>
      <p style={{ margin: '4px 0 16px', color: '#4b5563', fontSize: 13, lineHeight: 1.5 }}>
        Confirm your identity so you can control and hide what's exposed, see who is looking for you, and ensure you are protected.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><span style={label}>First name</span><input style={field} value={form.firstName} onChange={set('firstName')} /></div>
        <div><span style={label}>Last name</span><input style={field} value={form.lastName} onChange={set('lastName')} /></div>
        <div><span style={label}>Middle name <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></span><input style={field} value={form.middleName} onChange={set('middleName')} placeholder="helps narrow it down" /></div>
        <div><span style={label}>City</span><input style={field} value={form.city} onChange={set('city')} placeholder="e.g. Los Angeles" /></div>
        <div><span style={label}>State</span><input style={field} value={form.state} onChange={set('state')} placeholder="CA" maxLength={2} /></div>
        <div><span style={label}>Age</span><input style={field} value={form.age} onChange={set('age')} placeholder="e.g. 42" inputMode="numeric" /></div>
      </div>
      {err && <p style={{ color: '#b91c1c', fontSize: 13, margin: '10px 0 0' }}>{err}</p>}
      <div style={{ marginTop: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
        <button type="submit" style={{ background: GREEN_CTA, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Continue</button>
        <button type="button" onClick={hideForNow} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Maybe later</button>
      </div>
    </form>
  );
}
