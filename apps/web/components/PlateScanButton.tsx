// Point the camera at a data plate instead of typing what it says.
//
// The endpoint behind this was built, tested and quota-metered long before it
// was wired into anything, and for a while it existed on exactly one page.
// This is the shared control so it can sit wherever a make, model or serial
// number is being asked for.
//
// It never saves. The scan fills the fields and a person checks them, because
// vision models misread stamped and worn labels — a serial number that is
// confidently wrong is worse than an empty one, since nobody re-reads a field
// that already looks filled in.

import { useRef, useState } from 'react';
import { Button } from '@home-folder/ui';
import { scanPlatePhoto, scansRemaining, type PlateScanResult } from '../lib/plateScan';

type PlateScanButtonProps = {
  onScanned: (result: PlateScanResult) => void;
  /** False in demo mode: the endpoint is JWT-gated and metered per account. */
  signedIn: boolean;
  label?: string;
  hint?: string;
  disabled?: boolean;
};

export function PlateScanButton({
  onScanned,
  signedIn,
  label = 'Scan the data plate',
  hint = 'Take a photo of the label and the brand, model and serial number are filled in for you. Check them against the label — scanning can misread.',
  disabled = false
}: PlateScanButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PlateScanResult | null>(null);

  // The endpoint has always returned the allowance; showing it means the cap
  // is discovered before it is hit rather than by hitting it.
  const remaining = result ? scansRemaining(result) : null;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    setBusy(true);
    setError('');

    try {
      const scanned = await scanPlatePhoto(file);
      setResult(scanned);
      onScanned(scanned);
    } catch (failure) {
      setResult(null);
      setError(failure instanceof Error ? failure.message : 'Could not scan that photo.');
    } finally {
      setBusy(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  // Shown rather than hidden when signed out: the feature is worth knowing
  // about, and silently omitting it reads as the feature not existing.
  if (!signedIn) {
    return (
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Sign in to scan a data plate and have the make, model and serial filled in from a photo.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>{hint}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      <div>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || disabled}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Reading the label…' : label}
        </Button>
      </div>

      <p aria-live="polite" style={{ margin: 0, fontSize: '0.875rem' }}>
        {error ? (
          <span style={{ color: 'var(--status-urgent)' }}>{error}</span>
        ) : result ? (
          <span
            style={{
              color: result.confidence === 'high' ? 'var(--status-good)' : 'var(--color-clay)'
            }}
          >
            {result.brand || result.model_number || result.serial_number
              ? `Read with ${result.confidence} confidence — check it against the label.`
              : 'Nothing legible on that photo. Try again closer, or type it in.'}
            {remaining !== null ? ` ${remaining} scans left.` : ''}
          </span>
        ) : null}
      </p>
    </div>
  );
}
