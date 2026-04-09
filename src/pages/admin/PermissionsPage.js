import React, { useState } from 'react';
import styles from './PermissionsPage.module.css';

const MODULES = ['Customers', 'Orders', 'Payments', 'Opt-Outs', 'Notes', 'Tickets', 'CS Reps', 'Broadcast', 'Analytics', 'Content', 'Permissions'];

const ROLES = [
  {
    key: 'admin',
    label: 'Admin',
    description: 'Full access to all modules.',
    defaultModules: MODULES.reduce((acc, m) => ({ ...acc, [m]: true }), {}),
  },
  {
    key: 'support',
    label: 'Support',
    description: 'Customer-facing support staff.',
    defaultModules: {
      Customers: true, Orders: true, Payments: true, 'Opt-Outs': true,
      Notes: true, Tickets: true, 'CS Reps': false, Broadcast: false,
      Analytics: false, Content: false, Permissions: false,
    },
  },
  {
    key: 'editor',
    label: 'Editor',
    description: 'Content and broadcast management only.',
    defaultModules: {
      Customers: false, Orders: false, Payments: false, 'Opt-Outs': false,
      Notes: false, Tickets: false, 'CS Reps': false, Broadcast: true,
      Analytics: false, Content: true, Permissions: false,
    },
  },
];

const STORAGE_KEY = 'adminPermissions';

function loadPermissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return ROLES.reduce((acc, r) => ({ ...acc, [r.key]: { ...r.defaultModules } }), {});
}

function savePermissions(perms) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(perms));
}

const PermissionsPage = () => {
  const [permissions, setPermissions] = useState(() => loadPermissions());
  const [saved, setSaved] = useState(false);

  const toggle = (roleKey, module) => {
    setPermissions((prev) => ({
      ...prev,
      [roleKey]: { ...prev[roleKey], [module]: !prev[roleKey][module] },
    }));
    setSaved(false);
  };

  const handleSave = () => {
    savePermissions(permissions);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = (roleKey) => {
    const role = ROLES.find((r) => r.key === roleKey);
    if (!role) return;
    setPermissions((prev) => ({ ...prev, [roleKey]: { ...role.defaultModules } }));
    setSaved(false);
  };

  return (
    <main className={styles.page}>
      <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px', padding: '0.625rem 1rem', marginBottom: '1rem', fontSize: '0.8125rem', color: '#92400e' }}>
        Local data only — changes are stored in your browser and will not persist across devices.
      </div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Permissions Matrix</h1>
          <p className={styles.subtitle}>Select which modules each role can access.</p>
        </div>
        <button className={styles.saveBtn} onClick={handleSave}>
          {saved ? '✓ Saved' : 'Update Permissions'}
        </button>
      </div>

      <div className={styles.grid}>
        {ROLES.map((role) => (
          <div key={role.key} className={styles.roleCard}>
            <div className={styles.roleHeader}>
              <h2 className={styles.roleName}>{role.label}</h2>
              <p className={styles.roleDesc}>{role.description}</p>
            </div>
            <ul className={styles.moduleList}>
              {MODULES.map((mod) => {
                const checked = permissions[role.key]?.[mod] ?? false;
                const locked = role.key === 'admin'; // Admin always has full access
                return (
                  <li key={mod} className={styles.moduleItem}>
                    <label className={`${styles.moduleLabel} ${locked ? styles.locked : ''}`}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={checked}
                        onChange={() => !locked && toggle(role.key, mod)}
                        disabled={locked}
                      />
                      <span>{mod}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {role.key !== 'admin' && (
              <button
                className={styles.resetRoleBtn}
                onClick={() => handleReset(role.key)}
              >
                Reset to defaults
              </button>
            )}
          </div>
        ))}
      </div>

      {saved && <div className={styles.toast}>Permissions saved.</div>}
    </main>
  );
};

export default PermissionsPage;
