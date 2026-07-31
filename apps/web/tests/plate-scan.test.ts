import { describe, expect, it } from 'vitest';
import { normalizePlateScan } from '../lib/plateScan';

describe('normalizePlateScan', () => {
  it('trims the brand and keeps it as printed (case preserved)', () => {
    const result = normalizePlateScan({ brand: '  Samsung  ', confidence: 'high' });
    expect(result.brand).toBe('Samsung');
  });

  it('uppercases and strips spaces from model and serial numbers', () => {
    const result = normalizePlateScan({
      model_number: ' rf28 r7001 sr ',
      serial_number: 'ab 12 cd 34',
      confidence: 'high'
    });
    expect(result.model_number).toBe('RF28R7001SR');
    expect(result.serial_number).toBe('AB12CD34');
  });

  it('turns empty and whitespace-only strings into nulls', () => {
    const result = normalizePlateScan({
      brand: '   ',
      model_number: '',
      serial_number: '   ',
      notes: '',
      confidence: 'medium'
    });
    expect(result.brand).toBeNull();
    expect(result.model_number).toBeNull();
    expect(result.serial_number).toBeNull();
    expect(result.notes).toBeNull();
  });

  it('keeps a plausible manufacture year, accepting numeric strings', () => {
    expect(normalizePlateScan({ manufacture_year: 2018, confidence: 'high' }).manufacture_year).toBe(2018);
    expect(normalizePlateScan({ manufacture_year: '2018', confidence: 'high' }).manufacture_year).toBe(2018);
  });

  it('rejects years outside 1900..(current year + 1) rather than fabricating one', () => {
    const nextYear = new Date().getFullYear() + 1;
    expect(normalizePlateScan({ manufacture_year: 1899, confidence: 'high' }).manufacture_year).toBeNull();
    expect(normalizePlateScan({ manufacture_year: nextYear, confidence: 'high' }).manufacture_year).toBe(nextYear);
    expect(normalizePlateScan({ manufacture_year: nextYear + 1, confidence: 'high' }).manufacture_year).toBeNull();
    expect(normalizePlateScan({ manufacture_year: 'soon', confidence: 'high' }).manufacture_year).toBeNull();
  });

  it('defaults confidence to low when missing or unrecognised', () => {
    expect(normalizePlateScan({}).confidence).toBe('low');
    expect(normalizePlateScan({ confidence: 'certain' }).confidence).toBe('low');
    expect(normalizePlateScan({ confidence: 'medium' }).confidence).toBe('medium');
  });

  it('tolerates completely malformed input', () => {
    for (const junk of [null, undefined, 42, 'text', []]) {
      const result = normalizePlateScan(junk);
      expect(result.brand).toBeNull();
      expect(result.model_number).toBeNull();
      expect(result.serial_number).toBeNull();
      expect(result.manufacture_year).toBeNull();
      expect(result.confidence).toBe('low');
      expect(result.notes).toBeNull();
    }
  });
});
