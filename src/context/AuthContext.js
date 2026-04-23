import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setTokenGetter, setLogoutHandler } from '../api';

const AuthContext = createContext();

// Synthetic subscriptions set immediately after billing.sale get a timestamp so
// refreshSubscription can preserve them for a grace window while BC provisions
// the account (getUserOrders returns 403/empty during that window).
const SUBSCRIPTION_KEY = 'subscription';
const PROVISIONING_GRACE_MS = 2 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscriptionState] = useState(null);
  const subscriptionRef = useRef(null);
  const userRef = useRef(null);

  // Wrap setSubscription so every state write (from inside AuthContext OR from
  // callers like PaymentPage/AccountPage) also syncs localStorage. Supports
  // functional updates so refreshSubscription's `setSubscription(prev => ...)`
  // pattern keeps working.
  const setSubscription = useCallback((next) => {
    setSubscriptionState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      try {
        if (resolved && resolved.status === 'active') {
          localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(resolved));
        } else {
          localStorage.removeItem(SUBSCRIPTION_KEY);
        }
      } catch { /* localStorage may be unavailable in private mode — non-fatal */ }
      return resolved;
    });
  }, []);

  // Keep refs in sync so token useEffect can read latest values without extra dependencies
  useEffect(() => { subscriptionRef.current = subscription; }, [subscription]);
  useEffect(() => { userRef.current = user; }, [user]);

  // Set token getter for API client
  useEffect(() => {
    setTokenGetter(() => token);
  }, [token]);

  // Wire logout handler for token refresh interceptor (runs once on mount)
  useEffect(() => {
    setLogoutHandler(logout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch subscription status from BC getUserOrders whenever token changes.
  // A subscriber = has at least one order with status 'active' and transient.canceled false.
  const refreshSubscription = useCallback(async (currentToken) => {
    const t = currentToken || token;
    if (!t) { setSubscription(null); return; }
    try {
      const orders = await api.getUserOrders();
      if (process.env.NODE_ENV === 'development') {
        console.log('[AuthContext] getUserOrders result:', JSON.stringify(orders)?.substring(0, 600));
      }
      const activeOrders = Array.isArray(orders)
        ? orders.filter(o =>
            o.status === 'active' &&
            !o.transient?.canceled &&
            o.subStatus !== 'canceled'
          )
        : [];
      if (activeOrders.length > 0) {
        const order = activeOrders[0];
        setSubscription({
          status: 'active',
          plan: order.commerceOffers?.[0] || 'subscriber',
          dueDate: order.dueTimestamp ? new Date(order.dueTimestamp).toISOString() : null,
          orderId: order._id || order.id,
          cancelable: order.transient?.cancelable ?? false,
        });
      } else {
        // Empty activeOrders — BC may simply not have provisioned the account yet.
        // Preserve a recently-set synthetic subscription for up to PROVISIONING_GRACE_MS
        // so paid users don't get bounced to "Free Account" during the race.
        setSubscription(prev => {
          if (prev?.syntheticAt && Date.now() - prev.syntheticAt < PROVISIONING_GRACE_MS) return prev;
          return null;
        });
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AuthContext] refreshSubscription failed:', err?.message);
      }
      // Don't clear an already-active subscription on API failure (403 immediately
      // after billing.sale, flaky network, etc.).
      setSubscription(prev => {
        if (prev?.status === 'active') return prev;
        if (prev?.syntheticAt && Date.now() - prev.syntheticAt < PROVISIONING_GRACE_MS) return prev;
        return null;
      });
    }
  }, [token, setSubscription]);

  useEffect(() => {
    if (token) {
      // Admin/CSR users have no member subscription — skip getUserOrders (would 403).
      if (userRef.current?.role === 'admin') return;
      // Skip if subscription is already active — avoids a getUserOrders 403
      // immediately after billing.sale clears the subscription we just set.
      if (subscriptionRef.current?.status !== 'active') {
        refreshSubscription(token);
      }
    } else {
      setSubscription(null);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for stored session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    const storedSubscription = localStorage.getItem(SUBSCRIPTION_KEY);

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Error parsing stored user:', err);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
      }
    }
    if (storedSubscription) {
      try {
        // Restore directly into state (skip the persist wrapper — we just read from storage).
        setSubscriptionState(JSON.parse(storedSubscription));
      } catch (err) {
        localStorage.removeItem(SUBSCRIPTION_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const data = await api.login({ email, password });
      if (!data.accessToken) {
        // BC session established but no token returned — should not happen with synthetic token logic.
        throw new Error('Login succeeded but no session token was returned. Please try again.');
      }
      const userData = data.user || { role: 'member' };

      setToken(data.accessToken);
      setUser(userData);

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
    setSubscription(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem(SUBSCRIPTION_KEY);
    try {
      await api.logout(); // Call API logout
    } catch (err) {
      console.warn('[Auth] Logout request failed:', err?.message || err);
    } finally {
      navigate('/');
    }
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
    isPaid,
    refreshSubscription,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);