import { describe, expect, it } from 'vitest';
import {
  MIN_MODEL_MATCH_LENGTH,
  modelMatchesRecallText,
  normalizeModelNumber
} from '../lib/recalls';
import {
  ASSET_LIFESPANS,
  expectedLifespanYears,
  lifespanStatus
} from '@home-folder/shared';

// All pure functions: no supabase client, no network, no browser. The matcher
// tested here is the canonical copy; supabase/functions/check-recalls/index.ts
// carries a marked duplicate (Deno cannot import this workspace) — keep in sync.

describe('normalizeModelNumber', () => {
  it('uppercases and strips spaces and dashes', () => {
    expect(normalizeModelNumber('wf45-t6000 a')).toBe('WF45T6000A');
    expect(normalizeModelNumber('WF45T6000A')).toBe('WF45T6000A');
    expect(normalizeModelNumber('  ge - jvm 3160 ')).toBe('GEJVM3160');
  });

  it('returns an empty string for non-strings', () => {
    expect(normalizeModelNumber(null)).toBe('');
    expect(normalizeModelNumber(undefined)).toBe('');
  });
});

describe('modelMatchesRecallText', () => {
  it('matches exact model containment across formatting differences', () => {
    expect(
      modelMatchesRecallText('WF45-T6000A', ['Samsung front-load washer model WF45T6000A recalled'])
    ).toBe(true);
    expect(modelMatchesRecallText('wf45t6000a', ['Model: WF45T6000A'])).toBe(true);
  });

  it('matches against any of several text fragments', () => {
    expect(
      modelMatchesRecallText('JVM3160', ['Some other title', 'Products include GE JVM3160 microwave'])
    ).toBe(true);
  });

  it('does not match when the model does not appear', () => {
    expect(modelMatchesRecallText('WF45T6000A', ['Samsung top-load washer WA50R5400'])).toBe(false);
  });

  it('rejects short model strings below the minimum length', () => {
    expect(MIN_MODEL_MATCH_LENGTH).toBe(4);
    // 'X-5' normalizes to 'X5' (2 chars) and would match half the alphabet.
    expect(modelMatchesRecallText('X-5', ['Recall for model X5 heaters'])).toBe(false);
    expect(modelMatchesRecallText('200', ['Model 200 recalled'])).toBe(false);
  });

  it('handles empty and null inputs safely', () => {
    expect(modelMatchesRecallText('', ['anything'])).toBe(false);
    expect(modelMatchesRecallText(null, ['anything'])).toBe(false);
    expect(modelMatchesRecallText('WF45T6000A', [])).toBe(false);
    expect(modelMatchesRecallText('WF45T6000A', [null, undefined])).toBe(false);
  });

  it('is conservative about model ranges: no expansion, containment only', () => {
    const rangeText = 'Recall covers models WF45T6000A through WF45T6999Z';
    // The literal endpoints match…
    expect(modelMatchesRecallText('WF45T6000A', [rangeText])).toBe(true);
    // …but a model inside the range that is not literally present does not.
    // False negatives are acceptable; false positives are not.
    expect(modelMatchesRecallText('WF45T6500B', [rangeText])).toBe(false);
  });
});

describe('expectedLifespanYears', () => {
  it('matches on asset_type first (direct category key)', () => {
    expect(expectedLifespanYears('water_heater', 'Basement unit')).toBe(
      ASSET_LIFESPANS.water_heater.years
    );
    expect(expectedLifespanYears('furnace', null)).toBe(ASSET_LIFESPANS.furnace.years);
  });

  it('falls back to name keywords for generic asset types', () => {
    expect(expectedLifespanYears('appliance', 'Bosch dishwasher')).toBe(
      ASSET_LIFESPANS.dishwasher.years
    );
    expect(expectedLifespanYears('appliance', 'Rheem Water Heater 50gal')).toBe(
      ASSET_LIFESPANS.water_heater.years
    );
  });

  it('prefers the longest matching keyword', () => {
    // "garage door opener" must win over "garage door".
    expect(expectedLifespanYears('other', 'Chamberlain garage door opener')).toBe(
      ASSET_LIFESPANS.garage_door_opener.years
    );
  });

  it('returns null when nothing matches', () => {
    expect(expectedLifespanYears('furniture', 'Leather sofa')).toBeNull();
    expect(expectedLifespanYears(null, null)).toBeNull();
    expect(expectedLifespanYears('appliance', '')).toBeNull();
  });
});

describe('lifespanStatus', () => {
  const TODAY = '2026-01-01';

  it('flags an asset past its expected life', () => {
    const result = lifespanStatus('2012-01-01', 10, TODAY);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('past_expected');
    expect(result?.ageYears).toBeCloseTo(14, 1);
    expect(result?.fraction).toBeGreaterThan(1);
  });

  it('flags nearing at exactly 80% of expected life (inclusive)', () => {
    // 2018-01-01 → 2026-01-01 is exactly 2922 days = 8.0 years of 365.25 days,
    // so fraction is exactly 0.8 against a 10-year expectancy.
    const result = lifespanStatus('2018-01-01', 10, TODAY);
    expect(result?.fraction).toBeCloseTo(0.8, 10);
    expect(result?.status).toBe('nearing');
  });

  it('reports within expected life below 80%', () => {
    const result = lifespanStatus('2022-01-01', 10, TODAY);
    expect(result?.status).toBe('within');
    expect(result?.fraction).toBeLessThan(0.8);
  });

  it('returns null with no purchase date', () => {
    expect(lifespanStatus(null, 10, TODAY)).toBeNull();
    expect(lifespanStatus(undefined, 10, TODAY)).toBeNull();
    expect(lifespanStatus('', 10, TODAY)).toBeNull();
    expect(lifespanStatus('not-a-date', 10, TODAY)).toBeNull();
  });

  it('returns null for non-positive expectancy and future purchase dates', () => {
    expect(lifespanStatus('2020-01-01', 0, TODAY)).toBeNull();
    expect(lifespanStatus('2020-01-01', -5, TODAY)).toBeNull();
    expect(lifespanStatus('2027-01-01', 10, TODAY)).toBeNull();
  });
});
