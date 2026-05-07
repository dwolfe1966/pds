import React from 'react';
import { useBrand } from '../services/brand';

/**
 * Inject the active brand's palette as CSS custom properties on :root,
 * plus override the existing --color-primary variable so all components
 * keyed off the design-system primary inherit the brand color.
 *
 * Mounted once at the App root so the variables are available before
 * any page renders.
 */
const BrandStyles = () => {
  const brand = useBrand();
  const css = `:root {
  --color-primary: ${brand.primaryColor};
  --color-primary-dark: ${brand.primaryColor};
  --color-primary-hover: ${brand.primaryColor};
  --color-primary-light: ${brand.accentColor};
  --color-bg-dark: ${brand.primaryColor};
  --brand-hero-bg: ${brand.heroBg};
  --brand-hero-title: ${brand.heroTitleColor};
  --brand-hero-subtitle: ${brand.heroSubtitleColor};
  --brand-features-bg: ${brand.featuresBg};
  --brand-feature-card-bg: ${brand.featureCardBg};
  --brand-feature-card-accent: ${brand.featureCardAccent};
  --brand-header-bg: ${brand.headerBg};
  --brand-header-active-tint: ${brand.headerActiveTint};
}`;
  return <style>{css}</style>;
};

export default BrandStyles;
