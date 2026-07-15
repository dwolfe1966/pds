import React from 'react';
import PageHeader, { PageShell } from '../../components/PageHeader';
import MyProfileReport from '../../components/MyProfileReport';

/**
 * DEV-ONLY preview of the report-as-profile / My Profile composition — no login, no BC. Lets us see
 * and dial in the layout locally while login routing is sorted out. Route: /dev/profile (dev-gated in
 * App.js). MyProfileReport with reportId=null renders the sample data in development.
 */
export default function ProfilePreviewPage() {
  return (
    <PageShell>
      <PageHeader title="My Profile" subtitle="Dev preview — how your report renders as your profile (sample data)." />

      {/* Identity hero (mock) — approximates the real vCard hero above the profile body. */}
      <div style={{ border: '1px solid #d7ddd9', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 10px rgba(17,24,39,0.06)', marginBottom: 16 }}>
        <div style={{ background: '#0d5d2f', color: '#fff', padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800 }}>J</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Jordan A. Rivera, 41</div>
            <div style={{ color: '#eafff0', fontSize: 14 }}>Los Angeles, CA</div>
            <div style={{ marginTop: 6, display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.18)', borderRadius: 999, padding: '2px 9px' }}>✓ Identity confirmed</span>
              <span style={{ fontSize: 11, fontWeight: 700, background: '#fff', color: '#0d5d2f', borderRadius: 999, padding: '2px 9px' }}>🛡️ ID verified</span>
            </div>
          </div>
        </div>
      </div>

      <MyProfileReport reportId={null} />
    </PageShell>
  );
}
