import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setTokenGetter, setLogoutHandler } from '../api';
import {
  setUser as gtmSetUser,
  clearUser as gtmClearUser,
  setTransaction as gtmSetTransaction,
} from '../services/gtmContext';

const AuthContext = createContext();

// BC `billing.getOrders()` is the single source of truth for member subscription state.
// No synthetic state, no localStorage cache, no provisioning grace window — see
// feedback_subscription_state_authority.md.
export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  // True when the LAST subscription fetch failed because BC was unreachable (5xx/CORS/
  // network) — distinct from "no orders" (403). Lets the UI show "can't reach servers"
  // instead of rendering a paid member as wiped during a BC outage.
  const [subscriptionError, setSubscriptionError] = useState(false);
  const userRef = useRef(null);

  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    setTokenGetter(() => token);
  }, [token]);

  // Wire logout handler for token refresh interceptor (runs once on mount)
  useEffect(() => {
    setLogoutHandler(logout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Promote any logged-out contact-thread refs (captured under
  // pendingContactThreads:<email>) into the authenticated user's bucket
  // (accountThreads:<email>) so /account → Messages can resolve them.
  // BC has no consumer enumeration — refs captured at create time are the
  // only way to surface threads in-app. Without this migration, a user who
  // submitted /contact while logged out would lose their thread visibility
  // even after signing up with the same email.
  useEffect(() => {
    if (!user) return;
    const email = (user.email || '').trim().toLowerCase();
    if (!email) return;
    const pendingKey = `pendingContactThreads:${email}`;
    const targetKey = `accountThreads:${email}`;
    try {
      const raw = localStorage.getItem(pendingKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const pending = Array.isArray(parsed) ? parsed : [];
      if (pending.length === 0) {
        localStorage.removeItem(pendingKey);
        return;
      }
      const existingRaw = localStorage.getItem(targetKey);
      const existingParsed = existingRaw ? JSON.parse(existingRaw) : [];
      const existing = Array.isArray(existingParsed) ? existingParsed : [];
      const haveIds = new Set(existing.map((r) => r?.contactMessageId).filter(Boolean));
      const additions = pending.filter((r) => r?.contactMessageId && !haveIds.has(r.contactMessageId));
      if (additions.length > 0) {
        const merged = [...additions, ...existing].slice(0, 100);
        localStorage.setItem(targetKey, JSON.stringify(merged));
      }
      localStorage.removeItem(pendingKey);
    } catch {
      // Storage parse failure — nothing actionable; leave both keys alone.
    }
  }, [user]);

  // Fetch subscription state from BC. Returns the active subscription (or null) so
  // callers like PaymentPage can poll until BC has provisioned the order.
  const refreshSubscription = useCallback(async (currentToken) => {
    const t = currentToken || token;
    if (!t) {
      setSubscription(null);
      setSubscriptionLoading(false);
      return null;
    }
    if (userRef.current?.role === 'admin') {
      setSubscription(null);
      setSubscriptionLoading(false);
      return null;
    }
    setSubscriptionLoading(true);
    setSubscriptionError(false); // fresh attempt — only the catch re-raises it on a server error
    try {
      const orders = await api.getUserOrders();
      // An "operative" order grants access right now. Two cases:
      //   1) Fully active (subStatus undefined/null) — auto-renews.
      //   2) Cancelled but still in period (subStatus === 'canceled' AND
      //      dueTimestamp > now) — paid through to dueTimestamp; no renew.
      // Including (2) fixes #59 (cancelled trial users keep search access
      // through the paid window) and #50 (cancelled users see Reactivate,
      // not "Upgrade to Pro" → which BC rejects with nonMemberOnlyCommerceOffer).
      const now = Date.now();
      const operativeOrder = Array.isArray(orders)
        ? orders.find(o => {
            if (o.status !== 'active') return false;
            // Cancel-at-period-end: BC sets subStatus 'canceled' AND
            // transient.canceled=true, but access continues until dueTimestamp
            // (verified on the live order shape 2026-06-02). This MUST be checked
            // BEFORE the transient.canceled rejection below — otherwise a
            // cancelled-but-in-period order is wrongly treated as lapsed, which
            // is what made #57/#59 show "no active subscription" and forced the
            // #50 re-purchase path (BC then rejects nonMemberOnlyCommerceOffer).
            if (o.subStatus === 'canceled') {
              return !!(o.dueTimestamp && o.dueTimestamp > now);
            }
            if (o.transient?.canceled) return false;
            return true;
          })
        : null;
      if (operativeOrder) {
        const next = {
          status: 'active',
          subStatus: operativeOrder.subStatus || null, // 'canceled' = cancel pending
          plan: operativeOrder.commerceOffers?.[0] || 'subscriber',
          dueDate: operativeOrder.dueTimestamp ? new Date(operativeOrder.dueTimestamp).toISOString() : null,
          orderId: operativeOrder._id || operativeOrder.id,
          cancelable: operativeOrder.transient?.cancelable ?? false,
        };
        setSubscription(next);
        // Persist orderId into the GTM dataLayer context so returning paid
        // users carry it on every event, not just the one immediately after
        // a fresh billing.sale.
        gtmSetTransaction({ orderId: next.orderId });
        return next;
      }
      setSubscription(null);
      return null;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AuthContext] refreshSubscription failed:', err?.message);
      }
      // 403 = genuinely no orders (unpaid). A 5xx / CORS / network error means BC is
      // unreachable — flag that distinctly so the UI shows "can't reach servers" rather
      // than rendering a paid member as wiped/unpaid during an outage.
      const status = err?.status;
      const isServerError = err?.isCorsError === true
        || (typeof status === 'number' && status >= 500)
        || (status == null && /network|failed to fetch|gateway|timeout|50[234]/i.test(err?.message || ''));
      if (isServerError) setSubscriptionError(true);
      setSubscription(null);
      return null;
    } finally {
      setSubscriptionLoading(false);
    }
  }, [token]);

  // Refetch on every token change. BC is authoritative; never skip.
  useEffect(() => {
    refreshSubscription(token);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore token+user from localStorage on mount. Subscription is NEVER restored
  // from localStorage — it's always fetched fresh from BC.
  useEffect(() => {
    const storedToken = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');

    // Defensive cleanup: drop any legacy persisted subscription from prior versions.
    localStorage.removeItem('subscription');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        gtmSetUser({
          email: parsed.email,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          phone: parsed.phone,
          zip: parsed.zip,
        });
      } catch (err) {
        console.error('Error parsing stored user:', err);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const data = await api.login({ email, password });
      if (!data.accessToken) {
        throw new Error('Login succeeded but no session token was returned. Please try again.');
      }
      const userData = data.user || { role: 'member' };

      setToken(data.accessToken);
      setUser(userData);
      gtmSetUser({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        zip: userData.zip,
      });

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('user', JSON.stringify(userData));
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      return userData;
    } catch (err) {
      console.error('Login failed', err);
      throw err;
    }
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    gtmClearUser();
    setSubscription(null);
    setSubscriptionLoading(false);
    setSubscriptionError(false);
    // Kill the BC server session FIRST (while the cookie/token still exist) so a later session-check
    // can't silently re-authenticate the just-logged-out user.
    try {
      await api.logout();
    } catch (err) {
      console.warn('[Auth] Logout request failed:', err?.message || err);
    }
    // Then wipe ALL client stores — not just the 3 auth keys. Residual session/user/report/search
    // caches were auto-restoring the prior user on the next page (e.g. going to Search). Clearing
    // everything guarantees a clean logged-out state.
    try { localStorage.clear(); } catch { /* storage unavailable */ }
    try { sessionStorage.clear(); } catch { /* storage unavailable */ }
    navigate('/');
  };

  const isPaid = !!(subscription?.status === 'active' && subscription?.plan);

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    setUser,
    setToken,
    subscription,
    setSubscription,
    subscriptionLoading,
    subscriptionError,
    isPaid,
    refreshSubscription,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
