/**
 * Design System for IDLookup.AI
 * Based on PQS production site design patterns
 * Colors, typography, spacing, and component styles
 */

export const colors = {
  // Primary colors (Green Palette - Production IDLookup.AI)
  primary: {
    main: '#0d5d2f',      // Dark green
    dark: '#0a4a25',      // Darker green
    light: '#1a7a4a',     // Lighter green
    hover: '#2d8659',     // Hover state
  },
  
  // Secondary colors
  secondary: {
    main: '#28a745',      // Green accent
    dark: '#218838',
    light: '#34c759',
  },
  
  // Accent colors
  accent: {
    success: '#28a745',   // Green
    warning: '#ffc107',   // Yellow/Amber
    error: '#dc3545',     // Red
    info: '#17a2b8',      // Teal
  },
  
  // Neutral colors
  neutral: {
    white: '#ffffff',
    gray50: '#f9fafb',
    gray100: '#f3f4f6',
    gray200: '#e5e7eb',
    gray300: '#d1d5db',
    gray400: '#9ca3af',
    gray500: '#6b7280',
    gray600: '#4b5563',
    gray700: '#374151',
    gray800: '#1f2937',
    gray900: '#111827',
    black: '#000000',
  },
  
  // Text colors
  text: {
    primary: '#111827',   // Dark gray for main text
    secondary: '#6b7280', // Medium gray for secondary text
    tertiary: '#9ca3af',  // Light gray for tertiary text
    inverse: '#ffffff',   // White for text on dark backgrounds
    link: '#4a90e2',      // Blue for links
    linkHover: '#357abd', // Darker blue for link hover
  },
  
  // Background colors
  background: {
    default: '#ffffff',
    paper: '#f9fafb',
    dark: '#0e123b',
    light: '#f3f4f6',
  },
  
  // Border colors
  border: {
    light: '#e5e7eb',
    medium: '#d1d5db',
    dark: '#9ca3af',
  },
};

export const typography = {
  fontFamily: {
    primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    secondary: 'Georgia, "Times New Roman", serif',
    mono: '"Courier New", Courier, monospace',
  },
  
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
  },
  
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  
  lineHeight: {
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
};

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
  '4xl': '6rem',   // 96px
};

export const borderRadius = {
  none: '0',
  sm: '0.25rem',   // 4px
  md: '0.375rem',  // 6px
  lg: '0.5rem',    // 8px
  xl: '0.75rem',   // 12px
  '2xl': '1rem',   // 16px
  full: '9999px',
};

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
};

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// Component styles
export const components = {
  button: {
    primary: {
      backgroundColor: colors.primary.main,
      color: colors.text.inverse,
      padding: `${spacing.sm} ${spacing.lg}`,
      borderRadius: borderRadius.md,
      fontWeight: typography.fontWeight.semibold,
      fontSize: typography.fontSize.base,
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      '&:hover': {
        backgroundColor: colors.primary.hover,
        transform: 'translateY(-1px)',
        boxShadow: shadows.md,
      },
      '&:active': {
        transform: 'translateY(0)',
      },
    },
    secondary: {
      backgroundColor: 'transparent',
      color: colors.primary.main,
      padding: `${spacing.sm} ${spacing.lg}`,
      borderRadius: borderRadius.md,
      fontWeight: typography.fontWeight.semibold,
      fontSize: typography.fontSize.base,
      border: `2px solid ${colors.primary.main}`,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      '&:hover': {
        backgroundColor: colors.primary.main,
        color: colors.text.inverse,
      },
    },
    outline: {
      backgroundColor: 'transparent',
      color: colors.text.inverse,
      padding: `${spacing.sm} ${spacing.lg}`,
      borderRadius: borderRadius.md,
      fontWeight: typography.fontWeight.semibold,
      fontSize: typography.fontSize.base,
      border: `2px solid ${colors.text.inverse}`,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      '&:hover': {
        backgroundColor: colors.text.inverse,
        color: colors.primary.main,
      },
    },
  },
  
  input: {
    base: {
      width: '100%',
      padding: `${spacing.sm} ${spacing.md}`,
      fontSize: typography.fontSize.base,
      border: `1px solid ${colors.border.medium}`,
      borderRadius: borderRadius.md,
      fontFamily: typography.fontFamily.primary,
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      '&:focus': {
        outline: 'none',
        borderColor: colors.primary.main,
        boxShadow: `0 0 0 3px ${colors.primary.main}20`,
      },
      '&::placeholder': {
        color: colors.text.tertiary,
      },
    },
  },
  
  card: {
    base: {
      backgroundColor: colors.background.default,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      boxShadow: shadows.md,
      border: `1px solid ${colors.border.light}`,
    },
    hover: {
      transition: 'all 0.2s ease',
      '&:hover': {
        boxShadow: shadows.lg,
        transform: 'translateY(-2px)',
      },
    },
  },
  
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: `0 ${spacing.lg}`,
  },
};

// Helper function to create responsive styles
export const responsive = (breakpoint, styles) => {
  return `@media (min-width: ${breakpoints[breakpoint]}) { ${styles} }`;
};

// Export default theme object
export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  breakpoints,
  components,
};

