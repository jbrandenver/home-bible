import { useEffect, useRef } from 'react';
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
  // Secondary reads as a COLORED (gilt-tinted) button on the light document
  // ground — not a transparent "white" outline — while staying subordinate to
  // the solid-gilt primary. On dark surfaces (.brand-hero) the --btn-secondary-*
  // vars flip it back to a ghost button so a light fill never lands on green.
  const secondaryStyle: CSSProperties = {
    background: 'var(--btn-secondary-bg, var(--color-brass))',
    color: 'var(--btn-secondary-color, var(--color-ink))',
    border: '1px solid var(--btn-secondary-border, var(--color-brass))'
  };

  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 'var(--radius-control)',
    padding: '10px 16px',
    minHeight: 44,
    // The app has no global box-sizing reset; without this, padding + border
    // stack on top of minHeight and every control renders 68px tall.
    boxSizing: 'border-box',
    textDecoration: 'none',
    ...(variant === 'secondary' ? secondaryStyle : primaryStyle),
    color: hasCustomBackground
      ? 'var(--text-inverse)'
      : variant === 'secondary'
        ? 'var(--btn-secondary-color, var(--color-ink))'
        : 'var(--color-ink)',
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1.2,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.65 : 1,
    // Struck-plate emboss: token lives in globals.css so dark grounds
    // (.brand-hero) can swap it for a ghost-appropriate depth.
    boxShadow: disabled ? 'none' : 'var(--control-emboss, 0 1px 0 rgba(44,31,24,0.12))',
    ...style
  };
}

export function Button({
  children,
  type = 'button',
  style,
  disabled,
  variant = 'primary',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      {...rest}
      className={`hb-control ${className || ''}`.trim()}
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
  tone = 'default',
  interactive = false,
  id
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  tone?: 'default' | 'dark';
  interactive?: boolean;
  id?: string;
}) {
  const isDark = tone === 'dark';

  return (
    <section
      id={id}
      className={`hb-card ${interactive ? 'hb-card-hover' : ''} ${isDark ? 'brand-hero' : ''} ${className || ''}`.trim()}
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: '24px 24px 24px 28px',
        background: isDark ? undefined : 'var(--surface-card)',
        color: isDark ? 'var(--text-inverse)' : 'var(--text-primary)',
        boxShadow: 'var(--shadow-card)',
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
    <header style={{ marginBottom: 28 }}>
      <div
        className="hb-registry"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12
        }}
      >
        {eyebrow}
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 'clamp(1.9rem, 4vw, 2.9rem)',
          fontWeight: 600,
          lineHeight: 1.08,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          textWrap: 'balance',
          margin: 0,
          color: 'var(--color-ink)'
        }}
      >
        {title}
      </h1>
      {description ? (
        <p style={{ fontSize: 18, color: 'var(--text-muted)', maxWidth: 720, marginBottom: 0 }}>
          {description}
        </p>
      ) : null}
      {children ? <div style={{ marginTop: 14 }}>{children}</div> : null}
      <div className="hb-double-rule" aria-hidden="true" style={{ marginTop: 18 }} />
    </header>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        // width:100% + padding + border overflowed parent cards without this —
        // there is no global box-sizing reset in the app.
        boxSizing: 'border-box',
        padding: '12px 14px',
        fontSize: 16,
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
        boxSizing: 'border-box',
        padding: '12px 14px',
        fontSize: 16,
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
    <Card interactive>
      <h3 style={{ marginTop: 0 }}>{name}</h3>
      {type ? <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>{type}</p> : null}
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
      <h2 className="hb-leader" style={{ paddingBottom: 6, marginBottom: 16 }}>{title}</h2>
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

  // A struck status SEAL, not a pill: a ruled stamp with an inset highlight so
  // it reads as pressed into the page. The brassPale variant is a solid gilt
  // seal for the dark (green) hero ground. See globals.css .hb-seal.
  const sealInk = isBrassPale ? 'var(--shortcut-tag-color, #16302A)' : `var(--utility-badge-color, ${toneColor})`;

  return (
    <span
      className={`utility-badge hb-seal ${isBrassPale ? 'shortcut-tag-on-dark' : ''}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 'var(--radius-control)',
        padding: '5px 10px',
        background: isBrassPale ? 'var(--shortcut-tag-bg, #E3C288)' : 'transparent',
        color: sealInk,
        border: isBrassPale
          ? '1px solid var(--shortcut-tag-border, #C8923F)'
          : `1px solid ${toneColor === 'var(--color-ink)' ? 'var(--border-strong)' : 'currentColor'}`,
        boxShadow: isBrassPale ? 'none' : 'inset 0 0 0 1px rgba(255,253,246,0.4)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease'
      }}
    >
      {!isBrassPale && inferredTone !== 'neutral' ? (
        <span
          aria-hidden="true"
          style={{
            width: 5,
            height: 5,
            borderRadius: 99,
            background: toneColor,
            flexShrink: 0
          }}
        />
      ) : null}
      {label}
    </span>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  busy = false,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus management (WCAG 2.1.2 / 2.4.3): move focus into the dialog on open,
  // trap Tab inside, close on Esc, and restore focus to the opener on close.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    dialogRef.current?.querySelector<HTMLElement>(selector)?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = dialogRef.current?.querySelectorAll<HTMLElement>(selector);
      if (!f || f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="presentation"
      className="hb-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        background: 'rgba(34,22,16,0.5)'
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="hb-dialog"
        style={{
          width: 'min(420px, 100%)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border-strong)',
          borderTop: '3px solid var(--color-brass)',
          background: 'var(--surface-card-raised)',
          color: 'var(--text-primary)',
          padding: 22,
          boxShadow: 'var(--shadow-pop)'
        }}
      >
        <h2 id="confirm-dialog-title" style={{ marginTop: 0 }}>{title}</h2>
        <p style={{ color: 'var(--text-muted)' }}>{description}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={destructive ? { background: 'var(--status-urgent)', borderColor: 'var(--status-urgent)' } : undefined}
          >
            {busy ? 'Working...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function UndoToast({
  message,
  actionLabel = 'Undo',
  onAction,
  onDismiss
}: {
  message: string;
  actionLabel?: string;
  onAction: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="hb-toast"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 'min(420px, calc(100vw - 32px))',
        padding: 12,
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface-dark)',
        color: 'var(--text-inverse)',
        boxShadow: '0 14px 40px rgba(44,31,24,0.24)'
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onAction}
        style={{ color: 'inherit', background: 'transparent', border: 0, fontWeight: 700, cursor: 'pointer' }}
      >
        {actionLabel}
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        style={{ color: 'inherit', background: 'transparent', border: 0, cursor: 'pointer' }}
      >
        x
      </button>
    </div>
  );
}

export function RelatedList({
  title,
  empty,
  children
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  const hasChildren = Boolean(children);

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {hasChildren ? <div style={{ display: 'grid', gap: 10 }}>{children}</div> : <p style={{ color: 'var(--text-muted)' }}>{empty}</p>}
    </Card>
  );
}

export function RelatedItem({
  title,
  detail,
  href
}: {
  title: string;
  detail?: string | null;
  href?: string;
}) {
  const content = (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: 12,
        color: 'inherit',
        textDecoration: 'none'
      }}
    >
      <strong>{title}</strong>
      {detail ? <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{detail}</div> : null}
    </div>
  );

  return href ? (
    <a href={href} style={{ color: 'inherit', textDecoration: 'none' }}>
      {content}
    </a>
  ) : content;
}
