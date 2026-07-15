import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MyProfileModular from './MyProfileModular';
import { getReportDetail } from '../services/reportService';
import { extractAll } from '../utils/reportExtract';
import {
  getMappedIdentity, fetchMappedIdentity, fetchSuppression, setModuleDisposition, computeProtectionScore,
} from '../services/memberEnrichment';
import sampleProfileData from '../utils/sampleProfileData';

const DEV = process.env.NODE_ENV === 'development';

// Build a thin extractAll-shaped object from the mapped identity's enrichment, so a member who has
// mapped (but not pulled a full report) still sees a real profile — name, current location, work,
// education — instead of being asked to "find my record" again. The full report fills the rest.
function identityToProfileData(id) {
  if (!id || !(id.confirmed || id.name)) return null;
  const addresses = [];
  if (id.city || id.state) addresses.push({ id: 'cur', city: id.city, state: id.state });
  const jobs = [];
  if (id.employer || id.jobTitle || id.occupation) jobs.push({ id: 'j', employer: id.employer, title: id.jobTitle || id.occupation });
  const education = [];
  if (id.highSchool) education.push({ id: 'hs', school: id.highSchool });
  if (id.college) education.push({ id: 'col', school: id.college });
  return {
    fullName: id.name, aliases: [], dob: '', age: id.age, gender: '',
    currentLocation: [id.city, id.state].filter(Boolean).join(', '),
    addresses, phones: [], emails: [], relatives: [], jobs, education, social: [],
    properties: [], professionalLicenses: [], criminalRecords: [], liens: [], judgments: [],
    foreclosures: [], bankruptcies: [], driverLicenses: [], veteranRecords: [], businesses: [],
    sanctions: [], fraudFlags: [], arrests: [], arrestWatch: [], deaths: [], offenders: [],
    secondaryIdentities: [], counts: {},
  };
}

/**
 * Live modular My Profile — the real member's report mapped into MyProfileModular.
 * Data mapping: getReportDetail(reportId) -> extractAll(report) -> `data`; MyProfileModular reads the
 * same extractAll fields the report page does (phones/addresses/relatives/jobs/criminalRecords/…), so
 * the module set is a direct projection of the report. Hero comes from the mapped identity + Protection
 * Score. Dispositions load from and persist to the suppression store. In dev without a real report, we
 * fall back to sample data so the layout is visible.
 */
export default function MyProfileModularLive() {
  const [identity, setIdentity] = useState(() => getMappedIdentity());
  const [data, setData] = useState(null);
  const [reportLoading, setReportLoading] = useState(!!(getMappedIdentity() || {}).reportId);
  const [reportErr, setReportErr] = useState(false);
  const [dispositions, setDispositions] = useState(null); // null = not loaded yet
  const [suppressed, setSuppressed] = useState(false);
  const [hiddenFields, setHiddenFields] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchMappedIdentity().then((i) => { if (alive && i) setIdentity(i); });
    fetchSuppression().then((s) => {
      if (!alive) return;
      setDispositions(s.dispositions || {});
      setSuppressed(!!s.activityHidden);
      setHiddenFields(s.hiddenFields || []);
    });
    return () => { alive = false; };
  }, []);

  const reportId = (identity || {}).reportId;
  useEffect(() => {
    if (!reportId) { setReportLoading(false); return; }
    let alive = true;
    setReportLoading(true);
    setReportErr(false);
    getReportDetail(reportId)
      .then((r) => { if (!alive) return; try { setData(extractAll(r)); } catch { setReportErr(true); } })
      .catch(() => { if (alive) setReportErr(true); })
      .finally(() => { if (alive) setReportLoading(false); });
    return () => { alive = false; };
  }, [reportId]);

  // Prefer the real report; else build a thin profile from enrichment (mapped-but-no-report); else in
  // dev fall back to sample so the layout is always visible.
  const identityData = identityToProfileData(identity);
  const effectiveData = data || identityData || (DEV ? sampleProfileData : null);
  const usingPartial = !data && !!identityData; // real profile from enrichment, awaiting full report
  const ps = computeProtectionScore(identity, { suppressed, hiddenFields });
  const hero = {
    name: (identity && identity.name) || 'Your profile',
    age: identity && identity.age,
    location: [identity && identity.city, identity && identity.state].filter(Boolean).join(', '),
    verified: identity && identity.verified === 'id',
    score: ps && ps.score,
  };

  const onDispositionChange = (module, disposition) => {
    setModuleDisposition(module, disposition, { name: identity && identity.name, state: identity && identity.state });
  };

  if (reportLoading || dispositions === null) {
    return <div style={{ padding: '24px 4px', color: '#6b7280', fontSize: 14 }}>Loading your profile…</div>;
  }
  if (!effectiveData) {
    // Truly not mapped yet.
    return (
      <div style={{ border: '1px solid #d7ddd9', borderRadius: 12, padding: '18px 20px', background: '#f8faf9' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>Build your profile</div>
        <p style={{ margin: '6px 0 12px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.5 }}>
          Confirm your identity to populate your profile modules.
        </p>
        <Link to="/people-search" style={{ display: 'inline-block', background: '#0d5d2f', color: '#fff', borderRadius: 8, padding: '11px 22px', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
          Find my record →
        </Link>
      </div>
    );
  }

  return (
    <>
      {usingPartial && (
        <div style={{ marginBottom: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#166534', lineHeight: 1.5 }}>This is your profile from what we know so far. Pull your full report to fill in contact info, records, and more.</span>
          <Link to="/people-search" style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, color: '#fff', background: '#0d5d2f', borderRadius: 8, padding: '8px 16px', textDecoration: 'none' }}>Complete my profile →</Link>
        </div>
      )}
      <MyProfileModular
        data={effectiveData}
        hero={hero}
        dispositions={dispositions}
        onDispositionChange={onDispositionChange}
      />
    </>
  );
}
