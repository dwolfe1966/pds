import React from 'react';

const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '4px', maxWidth: '500px', width: '100%' }}>
        <button onClick={onClose} style={{ float: 'right', background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
        <div style={{ marginTop: '1rem' }}>{children}</div>
      </div>
    </div>
  );
};

export default Modal;