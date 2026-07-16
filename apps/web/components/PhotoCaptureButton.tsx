import { useRef, useState } from 'react';
import { Button } from '@home-folder/ui';
import {
  uploadDocumentForContext,
  type DocumentDataContext,
  type DocumentLinkField
} from '../lib/documents';

// One-tap photo capture for the walk-the-house flow. On phones the capture
// attribute opens the camera directly; on desktop it's a normal file picker.
// Uploads run through the existing compressed pipeline (lib/images + documents),
// so a captured photo is resized + thumbnailed before it ever leaves the device.
export function PhotoCaptureButton({
  context,
  linkField,
  linkId,
  title,
  onUploaded,
  label = 'Add photo'
}: {
  context: DocumentDataContext | null;
  linkField: DocumentLinkField;
  linkId: string;
  title: string;
  onUploaded?: () => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const disabled = !context || context.mode !== 'supabase' || busy;

  const handleFile = async (file: File | undefined) => {
    if (!file || !context) return;

    setBusy(true);
    setStatus('idle');
    setMessage('');

    try {
      await uploadDocumentForContext(context, {
        file,
        title,
        document_type: 'photo',
        [linkField]: linkId,
        visibility_contexts: ['personal_archive', 'insurance']
      });
      setStatus('done');
      setMessage('Photo saved');
      onUploaded?.();
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        title={context?.mode !== 'supabase' ? 'Sign in to save photos' : undefined}
      >
        {busy ? 'Saving…' : label}
      </Button>
      {status !== 'idle' ? (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: status === 'done' ? 'var(--status-good)' : 'var(--status-urgent)'
          }}
        >
          {message}
        </span>
      ) : null}
    </span>
  );
}
