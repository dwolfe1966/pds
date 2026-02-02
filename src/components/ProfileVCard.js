import React from 'react';
import styles from './ProfileVCard.module.css';

/**
 * V-card: rectangular profile box with visible and obfuscated attributes.
 * Used on search result detail preview for non-logged-in visitors.
 */
const ProfileVCard = ({ person }) => {
  if (!person) return null;

  const visible = [
    { label: 'Full Name', value: person.fullName || '—' },
    { label: 'Location', value: person.location || '—' },
    { label: 'Age Range', value: person.ageRange || '—' },
  ];

  const obfuscated = [
    { label: 'Phone', value: '***-***-' + (person.id || '****').toString().slice(-4) },
    { label: 'Email', value: (person.fullName || 'j***').charAt(0).toLowerCase() + '***@***.com' },
    { label: 'Address History', value: '🔒 Unlock in full report' },
    { label: 'Relatives', value: '🔒 Unlock in full report' },
    { label: 'Criminal History', value: '🔒 Unlock in full report' },
    { label: 'Financial History', value: '🔒 Unlock in full report' },
  ];

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.cardTitle}>Profile Preview</h2>
        <p className={styles.subtitle}>
          Some details are hidden. Sign up to view the full report.
        </p>
      </div>
      <div className={styles.grid}>
        {visible.map((item, i) => (
          <div key={`v-${i}`} className={styles.row}>
            <span className={styles.label}>{item.label}</span>
            <span className={item.label === 'Location' ? `${styles.value} ${styles.valueLocation}` : styles.value}>
              {item.value}
            </span>
          </div>
        ))}
        {obfuscated.map((item, i) => (
          <div key={`o-${i}`} className={styles.rowObfuscated}>
            <span className={styles.label}>{item.label}</span>
            <span className={styles.valueObfuscated}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileVCard;
