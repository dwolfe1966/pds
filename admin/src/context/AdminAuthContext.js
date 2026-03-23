import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import csrApi from '../services/csrApiService';

const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('adminUser');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { localStorage.removeItem('adminUser'); }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const data = await csrApi.login({ username, password });
    const userData = data.user || { email: username, role: 'admin' };
    setUser(userData);
    localStorage.setItem('adminUser', JSON.stringify(userData));
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('adminUser');
    try { await csrApi.logout(); } catch {}
    navigate('/login');
  };

  return (
    <AdminAuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => useContext(AdminAuthContext);
