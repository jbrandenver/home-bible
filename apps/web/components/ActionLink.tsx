import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { getControlStyle } from '@home-bible/ui';

type ActionLinkProps = {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
  style?: CSSProperties;
};

export function ActionLink({
  href,
  children,
  variant = 'primary',
  className,
  style
}: ActionLinkProps) {
  return (
    <Link
      href={href}
      className={`action-link ${className || ''}`.trim()}
      style={getControlStyle({ variant, style })}
    >
      {children}
    </Link>
  );
}
