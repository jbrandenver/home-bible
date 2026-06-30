import Link from 'next/link';
import type { CSSProperties } from 'react';

type ShortcutLinkVariant = 'brassOnDark' | 'outline' | 'subtle';

export function ShortcutLink({
  href,
  label,
  variant = 'subtle',
  ariaLabel,
  className,
  style
}: {
  href: string;
  label: string;
  variant?: ShortcutLinkVariant;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={`shortcut-link shortcut-link-${variant} ${className || ''}`.trim()}
      style={style}
    >
      {label}
    </Link>
  );
}
