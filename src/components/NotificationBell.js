import React, { useState } from 'react';

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  // Placeholder notifications
  const notifications = [];

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
      >
        🔔
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '2rem',
            backgroundColor: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            width: '250px',
            zIndex: 100,
          }}
        >
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {notifications.length === 0 && <li style={{ padding: '1rem' }}>No notifications</li>}
            {notifications.map((n) => (
              <li key={n.id} style={{ borderBottom: '1px solid #eee', padding: '0.5rem 1rem' }}>
                {n.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;