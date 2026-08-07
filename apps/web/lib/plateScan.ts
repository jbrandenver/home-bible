// Client side of the appliance data-plate scanner.
//
// The photo is downscaled and re-encoded in the browser (longest edge ~1568px,
// JPEG ~0.8 — the resolution the vision model actually reads at), base64'd,
// and sent to the analyze-plate Edge Function in one stateless call. The
// server never stores the photo; only a usage row is recorded there so the
// scan cap lives next to the API key instead of in the client.

import { getSupabaseSetupMessage } from './auth';
import { getSupabaseBrowserClient } from './supabase/client';

export type PlateScanConfidence = 'high' | 'medium' | 'low';

export type PlateScanResult = {
  brand: string | null;
  model_number: string | null;
  serial_number: string | null;
  manufacture_year: number | null;
  confidence: PlateScanConfidence;
  notes: string | null;
  /**
   * How much of the allowance is spent, as the server counts it. The endpoint
   * has always returned these; the client used to discard them, which meant a
   * bulk walkthrough could only discover the cap by hitting it. Null when the
   * response predates them or omits them.
   */
  scans_used: number | null;
  scan_cap: number | null;
};

// Slightly smaller than the photo pipeline's 1600px: 1568px is the largest
// edge the vision API reads without server-side downscaling, so anything
// bigger is wasted upload bytes.
const SCAN_MAX_DIMENSION = 1568;
const SCAN_JPEG_QUALITY = 0.8;

const MIN_PLAUSIBLE_YEAR = 1900;

function trimmedOrNull(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Model and serial numbers are effectively identifiers: uppercase, no spaces.
// Labels print them with spacing for readability ("RF28 R7001 SR"), and
// downstream matching (recalls, manuals) wants the canonical form.
function identifierOrNull(value: unknown): string | null {
  const trimmed = trimmedOrNull(value);
  return trimmed ? trimmed.replace(/\s+/g, '').toUpperCase() : null;
}

// A usage count is a non-negative whole number or nothing. Anything else means
// the field is absent or malformed, and a wrong count would misreport how much
// allowance someone has left.
function countOrNull(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }
  return Math.floor(numeric);
}

function yearOrNull(value: unknown): number | null {
  const numeric =
    typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;

  if (!Number.isFinite(numeric)) {
    return null;
  }

  const year = Math.round(numeric);
  const maxYear = new Date().getFullYear() + 1;

  // Outside the plausible window means the model misread the plate — a
  // fabricated "clamped" year would be confidently wrong, so drop it instead.
  if (year < MIN_PLAUSIBLE_YEAR || year > maxYear) {
    return null;
  }

  return year;
}

/**
 * Pure normaliser for whatever the scan endpoint (or a test) hands back:
 * trims strings, uppercases + de-spaces model and serial, keeps the year only
 * inside 1900..(current year + 1), and turns empty strings into nulls.
 */
export function normalizePlateScan(raw: unknown): PlateScanResult {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const confidence: PlateScanConfidence =
    source.confidence === 'high' || source.confidence === 'medium' || source.confidence === 'low'
      ? source.confidence
      : 'low';

  return {
    brand: trimmedOrNull(source.brand),
    model_number: identifierOrNull(source.model_number),
    serial_number: identifierOrNull(source.serial_number),
    manufacture_year: yearOrNull(source.manufacture_year),
    confidence,
    notes: trimmedOrNull(source.notes),
    scans_used: countOrNull(source.scans_used),
    scan_cap: countOrNull(source.scan_cap)
  };
}

/**
 * Scans left, or null when the server did not say. Never negative: an
 * over-count (a log row written for a scan the client never saw) must read as
 * "none left", not as a negative number on screen.
 */
export function scansRemaining(result: Pick<PlateScanResult, 'scans_used' | 'scan_cap'>): number | null {
  if (result.scans_used === null || result.scan_cap === null) {
    return null;
  }
  return Math.max(0, result.scan_cap - result.scans_used);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that photo. Try a JPEG or PNG.'));
    };
    image.src = url;
  });
}

// Always re-encodes to JPEG (unlike the upload pipeline, which keeps the
// original when compression does not help) so the server sees exactly one
// media type and the payload stays well under its size cap.
async function compressForScan(file: File): Promise<{ base64: string; mediaType: 'image/jpeg' }> {
  const bitmap = await loadBitmap(file);

  const sourceWidth = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width;
  const sourceHeight = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height;
  const scale = Math.min(1, SCAN_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not process that photo.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  if ('close' in bitmap) {
    bitmap.close();
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/jpeg', SCAN_JPEG_QUALITY);
  });

  if (!blob) {
    throw new Error('Could not process that photo.');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not process that photo.'));
    reader.readAsDataURL(blob);
  });

  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return { base64, mediaType: 'image/jpeg' };
}

// functions.invoke reports a generic "non-2xx status" message; the useful text
// and the status live on the Response it attaches as `context` (same pattern
// as the delete-account call in settings.tsx).
async function describeScanError(error: unknown): Promise<string> {
  let status: number | null = null;
  let bodyError: string | null = null;

  const context: unknown = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    status = context.status;
    try {
      const body = await context.json();
      if (body && typeof body.error === 'string') {
        bodyError = body.error;
      }
    } catch {
      /* body was not JSON — fall through to the generic messages */
    }
  }

  if (status === 503) {
    return "Scanning isn't enabled yet.";
  }
  if (status === 429) {
    return bodyError ?? 'You have used all your data-plate scans.';
  }
  if (bodyError) {
    return bodyError;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Could not scan that photo.';
}

/**
 * Compress the photo, send it to the analyze-plate Edge Function, and return
 * the normalised extraction. Requires a signed-in Supabase session — the
 * function is JWT-gated and the scan cap is per account.
 */
export async function scanPlatePhoto(file: File): Promise<PlateScanResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { base64, mediaType } = await compressForScan(file);

  const { data, error } = await supabase.functions.invoke('analyze-plate', {
    body: { image_base64: base64, media_type: mediaType }
  });

  if (error) {
    throw new Error(await describeScanError(error));
  }

  return normalizePlateScan(data);
}
