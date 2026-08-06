import React from 'react';
import { useAuth } from '../context/AuthContext';
import ProtectedRoute from './ProtectedRoute';
import MemberGeneralSearchPage from './member/MemberGeneralSearchPage';
import PeopleSearchHonestPage from './sales/PeopleSearchHonestPage';

/**
 * `/people-search` serves two audiences that previously COLLIDED on the same path:
 *   - logged-in MEMBERS → the tabbed Name / Phone / Email search (MemberGeneralSearchPage),
 *     which every member surface (MemberNav, Dashboard, ResultCard, Activity…) links to;
 *   - anonymous FUNNEL traffic → the public "honest" people-search landing (A/B challenger).
 *
 * Two `<Route path="/people-search">` entries used to be registered; React Router picks the
 * first on a path tie, so the public page shadowed the member page and members lost Phone &
 * Email search entirely. This single entry branches on auth instead:
 *   - a session (AuthContext token, or a stored accessToken while auth is still resolving)
 *     → member search, wrapped in ProtectedRoute so loading/redirect semantics match every
 *       other member route (no flash of the public page to a signed-in member);
 *   - otherwise → the public honest landing (unchanged behavior for anonymous visitors).
 */
export default function PeopleSearchEntry() {
  const { token } = useAuth();
  let storedToken = null;
  try { storedToken = localStorage.getItem('accessToken'); } catch { /* storage unavailable */ }
  const hasSession = Boolean(token || storedToken);

  if (hasSession) {
    return (
      <ProtectedRoute>
        <MemberGeneralSearchPage />
      </ProtectedRoute>
    );
  }
  return <PeopleSearchHonestPage />;
}
