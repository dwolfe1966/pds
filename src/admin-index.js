import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AdminApp from './AdminApp';
import { AuthProvider } from './context/AuthContext';
import './styles/variables.css';
import './styles/base.css';
import './styles/contentContainer.css';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AdminApp />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
