// Schedule rows and seals for the public (Persuade) surface — the register's
// dotted-leader grammar, shared by the landing page and the schedule of fees.

export function PlateRow({ label, value, onDark = false }: { label: string; value: string; onDark?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', padding: '0.42rem 0' }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: onDark ? 'var(--color-brass-pale)' : 'var(--color-brass-deep)',
          whiteSpace: 'nowrap'
        }}
      >
        {label}
      </span>
      <span
        aria-hidden="true"
        style={{
          flex: 1,
          borderBottom: `1px dotted ${onDark ? 'rgba(227,194,136,0.4)' : 'var(--gilt-line)'}`,
          transform: 'translateY(-4px)'
        }}
      />
      <span style={{ fontSize: '0.95rem', color: onDark ? 'var(--text-inverse)' : 'var(--text-primary)', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

export function PlateSeal({
  children,
  tone = 'attention',
  onDark = false
}: {
  children: string;
  tone?: 'good' | 'attention';
  onDark?: boolean;
}) {
  return (
    <span
      className={`hb-seal hb-seal-${tone}`}
      style={onDark ? { color: 'var(--color-brass-pale)', boxShadow: 'none' } : undefined}
    >
      {children}
    </span>
  );
}
