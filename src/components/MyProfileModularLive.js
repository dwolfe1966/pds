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

  const effectiveData = data || (DEV && (reportErr || !reportId) ? sampleProfileData : null);
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
    return (
      <div style={{ border: '1px solid #d7ddd9', borderRadius: 12, padding: '18px 20px', background: '#f8faf9' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>Build your profile</div>
        <p style={{ margin: '6px 0 12px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.5 }}>
          Pull your full report to populate your profile modules.
        </p>
        <Link to="/people-search" style={{ display: 'inline-block', background: '#0d5d2f', color: '#fff', borderRadius: 8, padding: '11px 22px', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
          Find my record →
        </Link>
      </div>
    );
  }

  return (
    <MyProfileModular
      data={effectiveData}
      hero={hero}
      dispositions={dispositions}
      onDispositionChange={onDispositionChange}
    />
  );
}
