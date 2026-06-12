import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AdminApp from './AdminApp';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { setAdminHandler } from './services/apiRouter';
import { callAdminAPI } from './services/apiRouterAdmin';
import './styles/variables.css';
import './styles/base.css';
import './styles/contentContainer.css';

// Register the admin (CSR) API dispatcher. This is the ONLY import of
// apiRouterAdmin/apiWrapperCsr — keeping the BC csrWrapper surface out of the
// consumer bundle. Must run before any admin page issues an admin-* request.
setAdminHandler(callAdminAPI);

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter basename="/csr" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ToastProvider>
          <AdminApp />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
