// "Tick what this home has."
//
// The grid puts more controls on one screen than the old one-room-at-a-time
// form did, and that is the point: the measure that matters is how many
// interactions and how many typed characters it takes to get a usable record,
// not how few boxes are visible. Twelve rooms here is one submit and no
// typing; the old form was twelve submits and a dozen typed names.
//
// Native checkboxes inside a real <fieldset>/<legend>, because a group of
// related choices is exactly what a fieldset is for, and because a custom chip
// widget would have to re-implement focus, keyboard and grouping semantics.

import { CountStepper } from './CountStepper';
import type { SpaceSelection, StarterSpace } from '../lib/starterTemplates';

type SpaceGridProps = {
  legend: string;
  hint?: string;
  spaces: ReadonlyArray<StarterSpace>;
  selection: SpaceSelection;
  idPrefix: string;
  disabled?: boolean;
  onChange: (key: string, count: number) => void;
};

// WCAG 2.2 target size is 24x24 minimum; a full-width row at 44px is
// comfortable on a phone and makes the whole line the target, not just the box.
const ROW_MIN_HEIGHT = 44;

export function SpaceGrid({
  legend,
  hint,
  spaces,
  selection,
  idPrefix,
  disabled = false,
  onChange
}: SpaceGridProps) {
  if (spaces.length === 0) {
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
        {spaces.map((space) => {
          const id = `${idPrefix}-${space.key}`;
          const count = selection[space.key] ?? 0;

          if (space.counted) {
            return (
              <div
                key={space.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  minHeight: ROW_MIN_HEIGHT,
                  flexWrap: 'wrap'
                }}
              >
                <label htmlFor={id} style={{ fontWeight: count > 0 ? 700 : 400 }}>
                  {space.label}
                  {space.label.endsWith('s') ? '' : 's'}
                </label>
                <CountStepper
                  id={id}
                  label={space.label}
                  value={count}
                  max={space.max}
                  disabled={disabled}
                  onChange={(next) => onChange(space.key, next)}
                />
              </div>
            );
          }

          return (
            <label
              key={space.key}
              htmlFor={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minHeight: ROW_MIN_HEIGHT,
                cursor: disabled ? 'default' : 'pointer',
                fontWeight: count > 0 ? 700 : 400
              }}
            >
              <input
                id={id}
                type="checkbox"
                checked={count > 0}
                disabled={disabled}
                onChange={(event) => onChange(space.key, event.target.checked ? 1 : 0)}
                style={{ width: 24, height: 24, flex: '0 0 auto', accentColor: 'var(--accent-strong)' }}
              />
              <span>{space.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
