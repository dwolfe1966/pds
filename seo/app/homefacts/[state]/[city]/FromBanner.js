'use client';

// Honesty banner for ZIP/address arrivals: "Showing {City} — the area we cover for {ZIP/address}". Reads the
// ?from= param CLIENT-side so the profile page itself stays statically generated / ISR-cached (reading
// searchParams in the server component forces DYNAMIC_SERVER_USAGE and 500s the ISR route).
import { useEffect, useState } from 'react';

export default function FromBanner({ city, stateCode }) {
  const [from, setFrom] = useState('');
  useEffect(() => {
    try { setFrom(new URLSearchParams(window.location.search).get('from') || ''); } catch { /* ignore */ }
  }, []);
  if (!from) return null;
  return (
    <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#344054', background: '#eef6f1', border: '1px solid #d7e8dc', borderRadius: 8, padding: '9px 13px' }}>
      Showing <strong>{city}, {stateCode}</strong> — the area we cover for <strong>{from}</strong>.
    </p>
  );
}
