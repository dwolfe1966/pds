import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setTokenGetter, setLogoutHandler } from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const subscriptionRef = useRef(null);

  // Keep ref in sync so token useEffect can read latest subscription without a dependency
  useEffect(() => { subscriptionRef.current = subscription; }, [subscription]);

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
        setSubscription(null);
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AuthContext] refreshSubscription failed:', err?.message);
      }
      // Don't clear an already-active subscription on API failure.
      // BC getUserOrders returns 403 immediately after billing.sale.
      setSubscription(prev => prev?.status === 'active' ? prev : null);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
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