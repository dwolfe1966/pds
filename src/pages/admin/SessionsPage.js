import React from 'react';

/**
 * Sessions are not available via the BC CSR API — BC manages sessions
 * server-side with cookies and does not expose a sessions endpoint.
 */
const SessionsPage = () => (
  <main style={{ padding: '2rem' }}>
    <h1>Sessions</h1>
    <p style={{ color: '#6b7280' }}>
      Session data is not available via the ByteCrtrs API. BC manages user sessions
      server-side via cookies and does not expose a sessions endpoint.
    </p>
  </main>
);

export default SessionsPage;
