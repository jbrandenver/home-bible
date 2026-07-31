import { describe, expect, it } from 'vitest';
import {
  buildSeasonalPlan,
  climateBandForState,
  type SeasonalPlanInput
} from '../lib/seasonalPlan';

const TYPICAL_HOME: SeasonalPlanInput = {
  state: 'OH',
  hasYard: true,
  hasBasement: true,
  utilityTypes: ['hvac_unit', 'water_heater', 'sump_pump', 'smoke_detector'],
  assetTypes: ['appliance']
};

function allTitles(input: SeasonalPlanInput): string[] {
  return buildSeasonalPlan(input).flatMap((month) => month.tasks.map((task) => task.title));
}

describe('climateBandForState', () => {
  it('classifies cold, hot, and mixed states from codes', () => {
    expect(climateBandForState('MN')).toBe('cold');
    expect(climateBandForState('FL')).toBe('hot');
    expect(climateBandForState('OH')).toBe('mixed');
  });

  it('accepts full state names and mixed case', () => {
    expect(climateBandForState('Minnesota')).toBe('cold');
    expect(climateBandForState('florida')).toBe('hot');
    expect(climateBandForState('mn')).toBe('cold');
  });

  it('falls back to mixed for unknown or missing states', () => {
    expect(climateBandForState(null)).toBe('mixed');
    expect(climateBandForState(undefined)).toBe('mixed');
    expect(climateBandForState('')).toBe('mixed');
    expect(climateBandForState('Atlantis')).toBe('mixed');
  });
});

describe('buildSeasonalPlan', () => {
  it('returns exactly 12 months, in order', () => {
    const plan = buildSeasonalPlan(TYPICAL_HOME);
    expect(plan).toHaveLength(12);
    expect(plan.map((entry) => entry.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('includes hose-bib winterization for a cold-band state (MN) and not for a hot one (FL)', () => {
    const mn = allTitles({ ...TYPICAL_HOME, state: 'MN' });
    const fl = allTitles({ ...TYPICAL_HOME, state: 'FL' });

    expect(mn.some((title) => title.includes('hose bibs'))).toBe(true);
    expect(fl.some((title) => title.includes('hose bibs'))).toBe(false);
  });

  it('winterization lands in October–November for the cold band', () => {
    const plan = buildSeasonalPlan({ ...TYPICAL_HOME, state: 'MN' });
    for (const entry of plan) {
      const hasHoseBibs = entry.tasks.some((task) => task.title.includes('hose bibs'));
      if (hasHoseBibs) {
        expect([10, 11]).toContain(entry.month);
      }
    }
    const winterMonths = plan
      .filter((entry) => entry.tasks.some((task) => task.title.includes('hose bibs')))
      .map((entry) => entry.month);
    expect(winterMonths).toEqual([10, 11]);
  });

  it('only includes the sump pump test when there is a basement', () => {
    const withBasement = allTitles({ ...TYPICAL_HOME, hasBasement: true });
    const withoutBasement = allTitles({ ...TYPICAL_HOME, hasBasement: false });

    expect(withBasement.some((title) => title.includes('sump pump'))).toBe(true);
    expect(withoutBasement.some((title) => title.includes('sump pump'))).toBe(false);
  });

  it('only includes gutter cleaning when there is a yard, in spring and fall', () => {
    const planWithYard = buildSeasonalPlan({ ...TYPICAL_HOME, hasYard: true });
    const gutterMonths = planWithYard
      .filter((entry) => entry.tasks.some((task) => task.title.includes('gutters')))
      .map((entry) => entry.month);
    expect(gutterMonths).toEqual([4, 10]);

    const withoutYard = allTitles({ ...TYPICAL_HOME, hasYard: false });
    expect(withoutYard.some((title) => title.includes('gutters'))).toBe(false);
  });

  it('conditions the dryer vent task on an appliance being on record', () => {
    const withAppliance = allTitles({ ...TYPICAL_HOME, assetTypes: ['appliance'] });
    const withoutAppliance = allTitles({ ...TYPICAL_HOME, assetTypes: [] });

    expect(withAppliance.some((title) => title.includes('dryer vent'))).toBe(true);
    expect(withoutAppliance.some((title) => title.includes('dryer vent'))).toBe(false);
  });

  it('gives every month at least one task for a typical home', () => {
    for (const entry of buildSeasonalPlan(TYPICAL_HOME)) {
      expect(entry.tasks.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('gives every month at least one task even for an empty profile', () => {
    const plan = buildSeasonalPlan({
      state: null,
      hasYard: false,
      hasBasement: false,
      utilityTypes: [],
      assetTypes: []
    });
    for (const entry of plan) {
      expect(entry.tasks.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('produces well-formed tasks with a title, a why, and only valid link hints', () => {
    for (const entry of buildSeasonalPlan(TYPICAL_HOME)) {
      for (const task of entry.tasks) {
        expect(typeof task.title).toBe('string');
        expect(task.title.length).toBeGreaterThan(0);
        expect(typeof task.why).toBe('string');
        expect(task.why.length).toBeGreaterThan(0);
        if (task.linkedType !== undefined) {
          expect(['utility', 'asset']).toContain(task.linkedType);
          expect(typeof task.keyword).toBe('string');
        }
      }
    }
  });

  it('is deterministic — the same profile yields the same plan', () => {
    expect(buildSeasonalPlan(TYPICAL_HOME)).toEqual(buildSeasonalPlan(TYPICAL_HOME));
  });
});
