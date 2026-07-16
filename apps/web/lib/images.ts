// Client-side image preparation for the near-zero-cost photo pipeline.
// Photos are resized + re-encoded in the browser before upload, and a small
// thumbnail is generated alongside so lists never download full-size images.
// No servers, no image-transformation fees — just canvas.

export const COMPRESSIBLE_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const PHOTO_MAX_DIMENSION = 1600;
export const PHOTO_JPEG_QUALITY = 0.82;
export const THUMBNAIL_MAX_DIMENSION = 240;
export const THUMBNAIL_JPEG_QUALITY = 0.7;

export type PreparedImage = {
  /** The file to upload — compressed when that made it smaller, original otherwise. */
  file: File;
  mimeType: string;
  /** Small JPEG preview, or null if thumbnail generation failed (non-fatal). */
  thumbnail: Blob | null;
  /** Original size in bytes, for "saved you X" messaging. */
  originalBytes: number;
};

export function isCompressibleImage(mimeType: string | null | undefined) {
  return Boolean(
    mimeType && (COMPRESSIBLE_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType.toLowerCase())
  );
}

function canUseCanvas() {
  return typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined';
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
      reject(new Error('Could not read the selected image.'));
    };
    image.src = url;
  });
}

function drawScaled(source: ImageBitmap | HTMLImageElement, maxDimension: number): HTMLCanvasElement {
  const sourceWidth = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const sourceHeight = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not process the selected image.');
  }

  // white backing so transparent PNGs re-encode cleanly to JPEG
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  return canvas;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}

function jpegFileName(originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, '') || 'photo';
  return `${base}.jpg`;
}

/**
 * Prepare an image for upload: resize to PHOTO_MAX_DIMENSION and re-encode as
 * JPEG, keeping the original only if compression didn't help. Also produces a
 * small thumbnail. Non-image files and processing failures fall back to the
 * original file so uploads never break because of this optimization.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  const fallback: PreparedImage = {
    file,
    mimeType: file.type,
    thumbnail: null,
    originalBytes: file.size
  };

  if (!isCompressibleImage(file.type) || !canUseCanvas()) {
    return fallback;
  }

  try {
    const bitmap = await loadBitmap(file);

    const photoCanvas = drawScaled(bitmap, PHOTO_MAX_DIMENSION);
    const compressed = await canvasToJpegBlob(photoCanvas, PHOTO_JPEG_QUALITY);

    const thumbCanvas = drawScaled(bitmap, THUMBNAIL_MAX_DIMENSION);
    const thumbnail = await canvasToJpegBlob(thumbCanvas, THUMBNAIL_JPEG_QUALITY);

    if ('close' in bitmap) {
      bitmap.close();
    }

    // Only swap in the compressed version when it actually saves bytes.
    if (compressed && compressed.size < file.size) {
      return {
        file: new File([compressed], jpegFileName(file.name), { type: 'image/jpeg' }),
        mimeType: 'image/jpeg',
        thumbnail,
        originalBytes: file.size
      };
    }

    return { ...fallback, thumbnail };
  } catch {
    return fallback;
  }
}
