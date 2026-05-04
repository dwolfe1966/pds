import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import styles from './ToastContext.module.css';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }) {
  const [message, setMessage] = useState('');
  const timeoutRef = useRef(null);

  const showToast = useCallback((msg) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessage(msg);
    timeoutRef.current = setTimeout(() => setMessage(''), 3000);
  }, []);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {message && <div className={styles.toast} role="status" aria-live="polite">{message}</div>}
    </ToastContext.Provider>
  );
}
