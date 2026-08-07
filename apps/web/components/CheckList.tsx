// A plain list of tick boxes in a labelled group.
//
// Used for the systems step, where every choice is yes/no — rooms need
// counters as well, so they have their own grid. Native checkboxes in a real
// fieldset for the same reason as there: the browser already gets focus,
// keyboard and grouping right.

type CheckListItem = {
  key: string;
  label: string;
  /** Optional one-line clarification under the label. */
  hint?: string;
};

type CheckListProps = {
  legend: string;
  hint?: string;
  items: ReadonlyArray<CheckListItem>;
  checked: Record<string, boolean>;
  idPrefix: string;
  disabled?: boolean;
  onToggle: (key: string, next: boolean) => void;
};

// WCAG 2.2 target size is 24x24 minimum; the whole row at 44px makes the line
// the target rather than just the box.
const ROW_MIN_HEIGHT = 44;

export function CheckList({
  legend,
  hint,
  items,
  checked,
  idPrefix,
  disabled = false,
  onToggle
}: CheckListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <fieldset
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: '4px 16px 12px',
        margin: 0,
        minWidth: 0
      }}
    >
      <legend style={{ padding: '0 6px', fontWeight: 700 }}>{legend}</legend>

      {hint ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 8px' }}>{hint}</p>
      ) : null}

      <div style={{ display: 'grid', gap: 2 }}>
        {items.map((item) => {
          const id = `${idPrefix}-${item.key}`;
          const isChecked = Boolean(checked[item.key]);

          return (
            <label
              key={item.key}
              htmlFor={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minHeight: ROW_MIN_HEIGHT,
                cursor: disabled ? 'default' : 'pointer',
                fontWeight: isChecked ? 700 : 400
              }}
            >
              <input
                id={id}
                type="checkbox"
                checked={isChecked}
                disabled={disabled}
                onChange={(event) => onToggle(item.key, event.target.checked)}
                style={{ width: 24, height: 24, flex: '0 0 auto', accentColor: 'var(--accent-strong)' }}
              />
              <span>
                {item.label}
                {item.hint ? (
                  <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 14, fontWeight: 400 }}>
                    {item.hint}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
