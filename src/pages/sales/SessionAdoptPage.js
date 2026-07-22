import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * SessionAdoptPage — landing target for a CSR "log in as user" (getAutoLoginUrl) link.
 *
 * BC's loginLink establishes the server session on this origin and redirects here. Our app hydrates auth
 * from a token in localStorage (AuthContext), so it doesn't pick up the cookie session on its own — this
 * page calls adoptSession() (a no-arg BC login that returns the logged-in user) to hydrate, then routes on.
 * On no live session it falls through to /login. Only lands here via the loginLink redirect.
 */
export default function SessionAdoptPage() {
  const { adoptSession } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [err, setErr] = useState(false);
  const ran = useRef(false);

  // Where to go after adopting — restricted to a safe in-app path (no open redirect).
  const rawNext = params.get('next') || '/dashboard';
  const next = /^\/[a-zA-Z0-9/_-]*$/.test(rawNext) ? rawNext : '/dashboard';

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    adoptSession()
      .then(() => navigate(next, { replace: true }))
      .catch(() => {
        // No live session (link expired/invalid, or the cookie didn't carry) — send to normal login.
        setErr(true);
        setTimeout(() => navigate('/login', { replace: true }), 1800);
      });
  }, [adoptSession, navigate, next]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', color: '#374151' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#0d5d2f', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ marginTop: 16, fontSize: '1rem', fontWeight: 600 }}>
        {err ? 'This login link is no longer valid — redirecting to sign in…' : 'Signing you in…'}
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
