import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes
} from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function Button({ children, type = 'button', style, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      {...rest}
      style={{
        border: '0',
        borderRadius: 14,
        padding: '12px 18px',
        background: '#1f2937',
        color: '#fff',
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.65 : 1,
        ...style
      }}
    >
      {children}
    </button>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <section
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 18,
        padding: 24,
        background: '#fff',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)'
      }}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description
}: {
  title: string;
  description?: string;
}) {
  return (
    <header style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 40, lineHeight: 1.1, margin: 0, color: '#111827' }}>
        {title}
      </h1>
      {description ? (
        <p style={{ fontSize: 18, color: '#4b5563', maxWidth: 720 }}>
          {description}
        </p>
      ) : null}
    </header>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        border: '1px solid #d1d5db',
        borderRadius: 12,
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
        border: '1px solid #d1d5db',
        borderRadius: 12,
        padding: '12px 14px',
        fontSize: 16,
        background: '#fff',
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
      {description ? <p style={{ color: '#6b7280' }}>{description}</p> : null}
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
      {type ? <p style={{ color: '#6b7280' }}>{type}</p> : null}
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
      <h2>{title}</h2>
      <div style={{ display: 'grid', gap: 16 }}>{children}</div>
    </section>
  );
}

export function UtilityBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        borderRadius: 999,
        padding: '6px 10px',
        background: '#fef3c7',
        color: '#111827',
        fontSize: 14,
        fontWeight: 700
      }}
    >
      {label}
    </span>
  );
}
