import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes
} from 'react';

type ButtonVariant = 'primary' | 'secondary';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

export function getControlStyle({
  variant = 'primary',
  disabled,
  style
}: {
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: CSSProperties;
} = {}): CSSProperties {
  const hasCustomBackground = Boolean(style && ('background' in style || 'backgroundColor' in style));
  const primaryStyle: CSSProperties = {
    background: 'var(--color-brass)',
    color: 'var(--color-ink)',
    border: '1px solid var(--color-brass)'
  };
  const secondaryStyle: CSSProperties = {
    background: 'transparent',
    color: 'var(--color-espresso)',
    border: '1px solid var(--border-subtle)'
  };

  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 'var(--radius-control)',
    padding: '11px 16px',
    minHeight: 44,
    textDecoration: 'none',
    ...(variant === 'secondary' ? secondaryStyle : primaryStyle),
    color: hasCustomBackground ? 'var(--text-inverse)' : variant === 'secondary' ? 'var(--color-espresso)' : 'var(--color-ink)',
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1.2,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.65 : 1,
    boxShadow: disabled ? 'none' : '0 1px 0 rgba(44,31,24,0.12)',
    ...style
  };
}

export function Button({
  children,
  type = 'button',
  style,
  disabled,
  variant = 'primary',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      {...rest}
      style={getControlStyle({ variant, disabled, style })}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  style,
  tone = 'default'
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  tone?: 'default' | 'dark';
}) {
  const isDark = tone === 'dark';

  return (
    <section
      className={`${isDark ? 'brand-hero' : ''} ${className || ''}`.trim()}
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: 24,
        background: isDark ? 'var(--surface-dark)' : 'var(--surface-card)',
        color: isDark ? 'var(--text-inverse)' : 'var(--text-primary)',
        boxShadow: '0 1px 0 rgba(44,31,24,0.08)',
        ...style
      }}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow = 'A home, documented.',
  children
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <header style={{ marginBottom: 24 }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          textTransform: 'uppercase',
          color: 'var(--color-brass-deep)',
          marginBottom: 6
        }}
      >
        {eyebrow}
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2rem, 4vw, 3rem)',
          lineHeight: 1.04,
          margin: 0,
          color: 'var(--color-ink)'
        }}
      >
        {title}
      </h1>
      {description ? (
        <p style={{ fontSize: 17, color: 'var(--text-muted)', maxWidth: 760 }}>
          {description}
        </p>
      ) : null}
      {children ? <div style={{ marginTop: 14 }}>{children}</div> : null}
    </header>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-control)',
        padding: '12px 14px',
        fontSize: 16,
        background: 'var(--surface-card)',
        color: 'var(--text-primary)',
        ...props.style
      }}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: '100%',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-control)',
        padding: '12px 14px',
        fontSize: 16,
        background: 'var(--surface-card)',
        color: 'var(--text-primary)',
        ...props.style
      }}
    />
  );
}

export function EmptyState({
  title,
  description
}: {
  title: string;
  description?: string;
}) {
  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {description ? <p style={{ color: 'var(--text-muted)' }}>{description}</p> : null}
    </Card>
  );
}

export function RoomCard({
  name,
  type
}: {
  name: string;
  type?: string;
}) {
  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>{name}</h3>
      {type ? <p style={{ color: 'var(--text-muted)' }}>{type}</p> : null}
    </Card>
  );
}

export function FloorSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>{title}</h2>
      <div style={{ display: 'grid', gap: 16 }}>{children}</div>
    </section>
  );
}

export function UtilityBadge({
  label,
  variant = 'default',
  tone = 'neutral'
}: {
  label: string;
  variant?: 'default' | 'brassPale';
  tone?: 'neutral' | 'good' | 'attention' | 'urgent';
}) {
  const isBrassPale = variant === 'brassPale';
  const inferredTone = (() => {
    const value = label.toLowerCase();
    if (/(urgent|error|high|expired|failed|delete)/.test(value)) return 'urgent';
    if (/(soon|attention|open|pending|due)/.test(value)) return 'attention';
    if (/(good|logged|complete|completed|active|saved|approved)/.test(value)) return 'good';
    return tone;
  })();
  const toneColor = inferredTone === 'good'
    ? 'var(--status-good)'
    : inferredTone === 'attention'
      ? 'var(--status-attention)'
      : inferredTone === 'urgent'
        ? 'var(--status-urgent)'
        : 'var(--color-ink)';

  return (
    <span
      className={`utility-badge ${isBrassPale ? 'shortcut-tag-on-dark' : ''}`.trim()}
      style={{
        display: 'inline-flex',
        borderRadius: 'var(--radius-control)',
        padding: '6px 10px',
        background: isBrassPale
          ? 'var(--shortcut-tag-bg, #E0BD83)'
          : 'var(--utility-badge-bg, rgba(224,189,131,0.22))',
        color: isBrassPale
          ? 'var(--shortcut-tag-color, #2C1F18)'
          : `var(--utility-badge-color, ${toneColor})`,
        border: isBrassPale
          ? '1px solid var(--shortcut-tag-border, #C8923F)'
          : '1px solid var(--utility-badge-border, rgba(168,118,44,0.22))',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        transition: 'background-color 140ms ease, color 140ms ease, border-color 140ms ease'
      }}
    >
      {label}
    </span>
  );
}
