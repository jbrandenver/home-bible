import type { CSSProperties } from 'react';

// The Our Home Folder mark — an engraved house sheltering a folder, struck
// with a check. Single-ink line art in the register's gilt; inherits
// currentColor so it takes brass-pale on the green chrome and brass-deep on
// paper. Static assets (favicons, OG image) mirror these paths in
// public/brand/. Detail lines (chimney, inner roof rule) stay legible down to
// ~40px; below that use the simplified favicon artwork instead.
export function BrandMark({
  size = 40,
  className,
  style
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 22 V10 H21 V16.3" strokeWidth="3" />
        <path d="M7 29 L32 7 L57 29" strokeWidth="3.2" />
        <path d="M12 27.6 L32 10.4 L52 27.6" strokeWidth="1.2" opacity="0.55" />
        <path d="M11.5 26 V55.5 H52.5 V26" strokeWidth="3.2" />
        <path d="M16.5 50.5 V32.5 H25.5 L28.5 35.5 H47.5 V50.5 Z" strokeWidth="2.8" />
        <path d="M24.5 42.5 L30.5 48 L43.5 31" strokeWidth="4" />
      </g>
    </svg>
  );
}
