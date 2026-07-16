import { describe, expect, it } from 'vitest';
import {
  getWarrantyMeta,
  safeFileName,
  safeHttpUrl,
  safeText,
  toLocalDateString
} from '@home-folder/shared';

describe('shared security helpers', () => {
  it('allows only HTTP(S) URLs', () => {
    expect(safeHttpUrl('https://example.com/manual.pdf')).toBe('https://example.com/manual.pdf');
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com/');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,hello')).toBeNull();
  });

  it('formats local calendar dates without UTC conversion', () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('scrubs sensitive text and URL-like filenames', () => {
    expect(safeText('garage code is 1234')).toBe('Hidden by privacy rule');
    expect(safeFileName('https://example.com/file.pdf')).toBeNull();
    expect(safeFileName('manual.pdf')).toBe('manual.pdf');
  });

  it('scrubs broadened secret phrasings (passcode/pin/combination/code:)', () => {
    expect(safeText('the passcode is 4729')).toBe('Hidden by privacy rule');
    expect(safeText('PIN 4729')).toBe('Hidden by privacy rule');
    expect(safeText('safe combination 12-24-6')).toBe('Hidden by privacy rule');
    expect(safeText('code: 1234')).toBe('Hidden by privacy rule');
    expect(safeText('alarm password')).toBe('Hidden by privacy rule');
    // legitimate text is preserved
    expect(safeText('Reset by holding the button 10 seconds')).toBe('Reset by holding the button 10 seconds');
    expect(safeText('Model number ABC-123')).toBe('Model number ABC-123');
  });

  it('calculates warranty status from explicit expiration dates', () => {
    expect(getWarrantyMeta({ warranty_expires_at: '2000-01-01' }).status).toBe('expired');
  });
});
