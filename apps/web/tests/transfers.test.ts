import { describe, expect, it } from 'vitest';
import { compactTransferCode, formatTransferCode, transferStatus } from '../lib/transfers';

// Pure helpers only: no supabase client, no network, no browser. The data
// wrappers in lib/transfers.ts are exercised through the RPCs they call
// (migration 025), which are guarded server-side.

const RAW_CODE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

describe('formatTransferCode', () => {
  it('groups a 64-hex code into dash-separated chunks of 8', () => {
    const formatted = formatTransferCode(RAW_CODE);
    expect(formatted.split('-')).toHaveLength(8);
    expect(formatted.split('-').every((chunk) => chunk.length === 8)).toBe(true);
    expect(formatted.replace(/-/g, '')).toBe(RAW_CODE);
  });

  it('regroups input that already carries dashes or whitespace', () => {
    expect(formatTransferCode(formatTransferCode(RAW_CODE))).toBe(formatTransferCode(RAW_CODE));
    expect(formatTransferCode(`  ${RAW_CODE.slice(0, 8)} ${RAW_CODE.slice(8)}  `)).toBe(formatTransferCode(RAW_CODE));
  });
});

describe('compactTransferCode', () => {
  it('round-trips a formatted code back to the raw code', () => {
    expect(compactTransferCode(formatTransferCode(RAW_CODE))).toBe(RAW_CODE);
  });

  it('accepts the raw code unchanged', () => {
    expect(compactTransferCode(RAW_CODE)).toBe(RAW_CODE);
  });

  it('strips arbitrary whitespace and dashes', () => {
    const scattered = `${RAW_CODE.slice(0, 10)}\n ${RAW_CODE.slice(10, 40)}-\t${RAW_CODE.slice(40)}`;
    expect(compactTransferCode(scattered)).toBe(RAW_CODE);
  });

  it('accepts uppercase input by lowercasing it', () => {
    expect(compactTransferCode(RAW_CODE.toUpperCase())).toBe(RAW_CODE);
    expect(compactTransferCode(formatTransferCode(RAW_CODE).toUpperCase())).toBe(RAW_CODE);
  });

  it('rejects wrong lengths', () => {
    expect(compactTransferCode(RAW_CODE.slice(0, 63))).toBeNull();
    expect(compactTransferCode(`${RAW_CODE}a`)).toBeNull();
    expect(compactTransferCode('')).toBeNull();
  });

  it('rejects non-hex characters even at the right length', () => {
    expect(compactTransferCode(`g${RAW_CODE.slice(1)}`)).toBeNull();
    expect(compactTransferCode(`${RAW_CODE.slice(0, 63)}z`)).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(compactTransferCode(null)).toBeNull();
    expect(compactTransferCode(undefined)).toBeNull();
  });
});

describe('transferStatus', () => {
  const NOW = '2026-07-30T12:00:00.000Z';
  const FUTURE = '2026-08-10T12:00:00.000Z';
  const PAST = '2026-07-01T12:00:00.000Z';

  const base = { claimed_at: null, revoked_at: null, expires_at: FUTURE };

  it('is active while unclaimed, unrevoked, and unexpired', () => {
    expect(transferStatus(base, NOW)).toBe('active');
  });

  it('is expired once the expiry instant has passed', () => {
    expect(transferStatus({ ...base, expires_at: PAST }, NOW)).toBe('expired');
  });

  it('is still active at the exact expiry instant (matches SQL expires_at < now())', () => {
    expect(transferStatus({ ...base, expires_at: NOW }, NOW)).toBe('active');
    expect(transferStatus({ ...base, expires_at: NOW }, '2026-07-30T12:00:00.001Z')).toBe('expired');
  });

  it('revoked beats expired', () => {
    expect(transferStatus({ ...base, revoked_at: PAST, expires_at: PAST }, NOW)).toBe('revoked');
  });

  it('claimed beats revoked and expired', () => {
    expect(transferStatus({ ...base, claimed_at: PAST, revoked_at: PAST, expires_at: PAST }, NOW)).toBe('claimed');
    expect(transferStatus({ ...base, claimed_at: PAST }, NOW)).toBe('claimed');
  });

  it('treats an unparseable expiry as not expired rather than guessing', () => {
    expect(transferStatus({ ...base, expires_at: 'not-a-date' }, NOW)).toBe('active');
  });
});
