import React from 'react';
import { useBrand } from '../services/brand';

/**
 * Brand-aware logo. Renders the brand's PNG when one is registered;
 * falls back to a color-tinted SVG chip with the brand initials so we
 * have a usable placeholder until real artwork is dropped in.
 */
const BrandLogo = ({ height = 36, style = {}, alt }) => {
  const brand = useBrand();
  const altText = alt || brand.name;
  const baseStyle = {
    height: `${height}px`,
    display: 'inline-block',
    verticalAlign: 'middle',
    ...style,
  };

  if (brand.logoAsset) {
    return <img src={brand.logoAsset} alt={altText} style={baseStyle} />;
  }

  // Placeholder: rounded chip with brand initials. Square aspect.
  const size = height;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={altText}
      style={baseStyle}
    >
      <rect width="40" height="40" rx="9" fill={brand.primaryColor} />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="16"
        fontWeight="700"
        fill="#ffffff"
      >
        {brand.initials}
      </text>
    </svg>
  );
};

export default BrandLogo;
