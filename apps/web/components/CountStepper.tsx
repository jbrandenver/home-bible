// "How many bedrooms?" as one press rather than three form submissions.
//
// A real <input type="number"> with a real <label>, plus two buttons. Not a
// custom widget: the native control already gives keyboard support, mobile
// numeric keypads and assistive-technology semantics that a div would have to
// re-implement badly.
//
// Deliberately no aria-live here. The count is announced by the input itself
// on change; the grid announces the running total once, elsewhere, so holding
// "+" does not produce a stream of interruptions.

type CountStepperProps = {
  id: string;
  label: string;
  value: number;
  max: number;
  min?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

const BUTTON_SIZE = 44;

function stepperButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    flex: '0 0 auto',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    font: 'inherit',
    fontSize: 20,
    lineHeight: 1,
    color: disabled ? 'var(--text-muted)' : 'var(--accent-strong)',
    background: 'var(--surface-card-raised)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-control)',
    cursor: disabled ? 'default' : 'pointer'
  };
}

export function CountStepper({
  id,
  label,
  value,
  max,
  min = 0,
  disabled = false,
  onChange
}: CountStepperProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.floor(next)));

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || atMin}
        // The visible "−" is a symbol, not a word; the accessible name has to
        // say which room it belongs to, because a screen-reader user hears
        // these buttons out of their visual context.
        aria-label={`One fewer ${label.toLowerCase()}`}
        style={stepperButtonStyle(disabled || atMin)}
      >
        <span aria-hidden="true">−</span>
      </button>

      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) ? clamp(parsed) : min);
        }}
        style={{
          width: 64,
          height: BUTTON_SIZE,
          textAlign: 'center',
          // 16px or larger, or iOS zooms the whole page on focus.
          fontSize: 16,
          font: 'inherit',
          color: 'var(--text-primary)',
          background: 'var(--surface-card-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-control)',
          boxSizing: 'border-box'
        }}
      />

      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || atMax}
        aria-label={`One more ${label.toLowerCase()}`}
        style={stepperButtonStyle(disabled || atMax)}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
