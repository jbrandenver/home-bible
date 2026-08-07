import { describe, expect, it } from 'vitest';
import { buildSeasonalPlan } from '../lib/seasonalPlan';
import {
  DEFAULT_SEED_HORIZON_DAYS,
  seasonalDueDate,
  selectSeedReminders
} from '../lib/seasonalSeed';
import type { SeasonalMonth } from '../lib/seasonalPlan';

// Fixed so the selection is assertable; the module takes `today` as a
// parameter precisely so tests never depend on the wall clock.
const JAN_10 = new Date(2026, 0, 10);

const PLAN: SeasonalMonth[] = [
  { month: 1, tasks: [{ title: 'Test the smoke alarms', why: 'They fail silently.' }] },
  { month: 2, tasks: [{ title: 'Bleed the radiators', why: 'Cold spots waste fuel.' }] },
  { month: 6, tasks: [{ title: 'Service the air conditioner', why: 'Before the first hot week.' }] },
  { month: 11, tasks: [{ title: 'Drain the outside tap', why: 'A frozen pipe splits.' }] }
];

describe('seasonalDueDate', () => {
  it('falls on the 15th of the plan month', () => {
    expect(seasonalDueDate(6, JAN_10)).toBe('2026-06-15');
  });

  it('rolls into next year for a month already past', () => {
    // In December, a January task belongs to the coming January.
    expect(seasonalDueDate(1, new Date(2026, 11, 3))).toBe('2027-01-15');
  });

  it('never returns a date in the past', () => {
    // The 15th of this month has gone; the task is due now, not last week.
    expect(seasonalDueDate(1, new Date(2026, 0, 20))).toBe('2026-01-20');
  });

  it('matches the current day when the mid-month date has just passed', () => {
    expect(seasonalDueDate(1, new Date(2026, 0, 16))).toBe('2026-01-16');
  });
});

describe('selectSeedReminders', () => {
  it('returns nothing for an empty plan', () => {
    expect(selectSeedReminders([], JAN_10)).toEqual([]);
  });

  it('seeds at most two by default', () => {
    expect(selectSeedReminders(PLAN, JAN_10).length).toBeLessThanOrEqual(2);
  });

  it('honours an explicit maximum', () => {
    expect(selectSeedReminders(PLAN, JAN_10, [], { max: 1 })).toHaveLength(1);
    expect(selectSeedReminders(PLAN, JAN_10, [], { max: 0 })).toEqual([]);
  });

  // The whole point of the horizon: the first monthly digest looks 35 days
  // ahead, so anything beyond it would be seeded and then not appear.
  it('only seeds what the first digest can see', () => {
    const seeded = selectSeedReminders(PLAN, JAN_10, [], { max: 10 });
    for (const reminder of seeded) {
      const due = new Date(`${reminder.due_date}T00:00:00`);
      const daysOut = Math.round((due.getTime() - JAN_10.getTime()) / 86_400_000);
      expect(daysOut).toBeGreaterThanOrEqual(0);
      expect(daysOut).toBeLessThanOrEqual(DEFAULT_SEED_HORIZON_DAYS);
    }
  });

  it('excludes tasks beyond the horizon entirely', () => {
    const titles = selectSeedReminders(PLAN, JAN_10, [], { max: 10 }).map((r) => r.title);
    expect(titles).not.toContain('Service the air conditioner');
    expect(titles).not.toContain('Drain the outside tap');
  });

  it('orders soonest first', () => {
    const seeded = selectSeedReminders(PLAN, JAN_10, [], { max: 10 });
    const dates = seeded.map((reminder) => reminder.due_date);
    expect(dates).toEqual([...dates].sort());
  });

  // Re-running the wizard, or arriving after adding tasks by hand on
  // /maintenance, must not write a second copy.
  it('skips titles the record already holds', () => {
    const seeded = selectSeedReminders(PLAN, JAN_10, ['Test the smoke alarms'], { max: 10 });
    expect(seeded.map((r) => r.title)).not.toContain('Test the smoke alarms');
  });

  it('matches existing titles ignoring case and surrounding space', () => {
    const seeded = selectSeedReminders(PLAN, JAN_10, ['  test THE smoke alarms '], { max: 10 });
    expect(seeded.map((r) => r.title)).not.toContain('Test the smoke alarms');
  });

  it('never repeats a title within one batch', () => {
    const repeated: SeasonalMonth[] = [
      { month: 1, tasks: [{ title: 'Test the smoke alarms', why: 'a' }] },
      { month: 1, tasks: [{ title: 'Test the smoke alarms', why: 'b' }] }
    ];
    expect(selectSeedReminders(repeated, JAN_10, [], { max: 10 })).toHaveLength(1);
  });

  it('writes a description that matches what /maintenance writes', () => {
    const [first] = selectSeedReminders(PLAN, JAN_10, [], { max: 1 });
    expect(first.description).toBe('They fail silently. (From your seasonal plan.)');
  });

  it('is deterministic for a fixed today', () => {
    expect(selectSeedReminders(PLAN, JAN_10)).toEqual(selectSeedReminders(PLAN, JAN_10));
  });

  it('seeds something real for an actual generated plan, in any month', () => {
    const plan = buildSeasonalPlan({
      state: 'MN',
      hasYard: true,
      hasBasement: true,
      utilityTypes: ['furnace', 'water_heater', 'smoke_detector'],
      assetTypes: []
    });

    for (let month = 0; month < 12; month += 1) {
      const seeded = selectSeedReminders(plan, new Date(2026, month, 5));
      expect(seeded.length, `no seed available in month ${month + 1}`).toBeGreaterThan(0);
      expect(seeded.length).toBeLessThanOrEqual(2);
    }
  });

  it('leaves nothing to seed once every nearby task is already recorded', () => {
    const plan = buildSeasonalPlan({
      state: 'MN',
      hasYard: true,
      hasBasement: true,
      utilityTypes: ['furnace'],
      assetTypes: []
    });

    const allTitles = plan.flatMap((month) => month.tasks.map((task) => task.title));
    expect(selectSeedReminders(plan, JAN_10, allTitles, { max: 10 })).toEqual([]);
  });
});
