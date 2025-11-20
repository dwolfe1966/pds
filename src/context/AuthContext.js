import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setTokenGetter } from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set token getter for API client
  useEffect(() => {
    setTokenGetter(() => token);
  }, [token]);

  // Optionally load token from cookie or session here
  useEffect(() => {
    // In this simple implementation we do not persist tokens between reloads
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const data = await api.login({ email, password });
      if (data.accessToken) {
        setToken(data.accessToken);
        // Fallback role: assume member if none provided
        const userData = data.user || {};
        if (!userData.role) {
          userData.role = 'member';
        }
        setUser(userData);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Login failed', err);
      throw err;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    navigate('/');
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    setUser,
    setToken,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);