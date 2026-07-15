import React from 'react';
import PageHeader, { PageShell } from '../../components/PageHeader';
import MyProfileModular from '../../components/MyProfileModular';
import sampleProfileData from '../../utils/sampleProfileData';

/**
 * DEV-ONLY preview of the modular My Profile experience — no login, no BC. Route: /dev/profile
 * (dev-gated in App.js). Lets us see and dial in the social-profile layout, per-module Protect/Promote,
 * insights, and the "Preview as" viewer switcher locally.
 */
export default function ProfilePreviewPage() {
  return (
    <PageShell>
      <PageHeader title="My Profile" subtitle="Dev preview — the social-profile experience (sample data)." />
      <MyProfileModular
        data={sampleProfileData}
        hero={{ name: 'Jordan A. Rivera', age: 41, location: 'Los Angeles, CA', verified: true, score: 72 }}
      />
    </PageShell>
  );
}
