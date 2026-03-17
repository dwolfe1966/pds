import React from 'react';
import styles from './Skeleton.module.css';

/**
 * Skeleton loading placeholder with CSS pulse animation.
 * Usage:
 *   <Skeleton variant="text" />
 *   <Skeleton variant="card" height={80} />
 *   <Skeleton variant="avatar" width={40} height={40} />
 */
const Skeleton = ({ variant = 'text', width, height, style, className }) => {
  const variantClass = styles[variant] || styles.text;
  return (
    <span
      className={`${styles.skeleton} ${variantClass} ${className || ''}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
};

export default Skeleton;
