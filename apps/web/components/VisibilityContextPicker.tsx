import { VISIBILITY_CONTEXTS, type VisibilityContext } from '@home-folder/shared';
import { formatVisibilityContextLabel, normalizeVisibilityContexts } from '../lib/visibility';

type VisibilityContextPickerProps = {
  value: VisibilityContext[];
  onChange: (value: VisibilityContext[]) => void;
  disabled?: boolean;
  idPrefix: string;
};

export function VisibilityContextPicker({
  value,
  onChange,
  disabled = false,
  idPrefix
}: VisibilityContextPickerProps) {
  const selectedContexts = normalizeVisibilityContexts(value);
  const selectedSet = new Set(selectedContexts);

  function toggleContext(context: VisibilityContext) {
    if (disabled) return;

    const nextValue = selectedSet.has(context)
      ? selectedContexts.filter((item) => item !== context)
      : [...selectedContexts, context];

    onChange(normalizeVisibilityContexts(nextValue));
  }

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ fontWeight: 600, marginBottom: 4 }}>Where should this appear?</legend>
      <p id={`${idPrefix}-hint`} style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Choose every report or handover context where this belongs.
      </p>
      <div
        role="group"
        aria-describedby={`${idPrefix}-hint`}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
      >
        {VISIBILITY_CONTEXTS.map((context) => {
          const checked = selectedSet.has(context);
          const id = `${idPrefix}-${context}`;

          return (
            <label
              key={context}
              htmlFor={id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 6,
                border: checked ? '1px solid var(--accent-strong)' : '1px solid var(--border-subtle)',
                background: checked ? 'rgba(227,194,136,0.14)' : '#fff',
                color: checked ? 'var(--accent-strong)' : 'var(--text-primary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.7 : 1,
                fontWeight: 600
              }}
            >
              <input
                id={id}
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggleContext(context)}
              />
              {formatVisibilityContextLabel(context)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
