import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProfileView from './ProfileView';
import { getReportDetail } from '../services/reportService';
import { extractAll } from '../utils/reportExtract';
import sampleProfileData from '../utils/sampleProfileData';

// DEV-only: the live report is forced to the BC API (unreachable on local/mock), so in development we
// preview the report-as-profile layout with sample data. process.env.NODE_ENV is 'production' in the
// build, so this is dead in prod.
const DEV = process.env.NODE_ENV === 'development';

function DevSampleBanner() {
  return (
    <div style={{ marginBottom: 12, background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 700 }}>
      🔧 Dev preview — sample data (your real report loads only on a BC-connected environment).
    </div>
  );
}

/**
 * Renders the member's OWN report inline as their profile ("your report is your profile" — see
 * docs/design/profile-concept-model.md). Fetches by reportId (the canonical, re-fetchable
 * commerceContentId), extracts, and renders ProfileView in the owner projection. Loading + error
 * states fall back to the standalone /people/:id page so the member always has a path to their data.
 */
export default function MyProfileReport({ reportId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!reportId); // no reportId → nothing to load
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!reportId) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    setErr(false);
    getReportDetail(reportId)
      .then((r) => { if (!alive) return; try { setData(extractAll(r)); } catch { setErr(true); } })
      .catch(() => { if (alive) setErr(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reportId]);

  if (loading) {
    return <div style={{ padding: '22px 4px', color: '#6b7280', fontSize: 14 }}>Loading your profile…</div>;
  }
  if (err || !data) {
    // DEV: show the sample so the layout is tunable locally (real report needs BC).
    if (DEV) {
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>📄 Your profile — everything public about you</div>
          </div>
          <DevSampleBanner />
          <ProfileView data={sampleProfileData} viewer="owner" />
        </div>
      );
    }
    return (
      <div style={{ border: '1px solid #d7ddd9', borderRadius: 12, padding: '18px 20px', background: '#f8faf9' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>📄 Your full background report</div>
        <p style={{ margin: '6px 0 12px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.5 }}>
          Every address, phone, relative, and public record tied to your identity.
        </p>
        <Link to={`/people/${reportId}`}
          style={{ display: 'inline-block', background: '#0d5d2f', color: '#fff', borderRadius: 8, padding: '11px 22px', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
          View your full report →
        </Link>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>📄 Your profile — everything public about you</div>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#6b7280' }}>This is the same record anyone else can pull on you. Hide what you don't want exposed above.</p>
        </div>
        <Link to={`/people/${reportId}`} style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#0d5d2f', textDecoration: 'none' }}>Open full page ↗</Link>
      </div>
      <ProfileView data={data} viewer="owner" />
    </div>
  );
}
