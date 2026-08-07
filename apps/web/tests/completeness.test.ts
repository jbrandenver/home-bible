import { describe, expect, it } from 'vitest';
import { computeCompleteness } from '../lib/completeness';
import type { AssetRow } from '../lib/assets';
import type { DocumentRow } from '../lib/documents';
import type { ReminderRow } from '../lib/reminders';
import type { UtilityRow } from '../lib/utilities';

function utility(utility_type: string): UtilityRow {
  return { id: `u-${utility_type}`, utility_type, name: utility_type } as unknown as UtilityRow;
}

function asset(id: string, extra: Partial<AssetRow> = {}): AssetRow {
  return {
    id,
    name: id,
    serial_number: null,
    purchase_price: null,
    warranty_expires_at: null,
    ...extra
  } as unknown as AssetRow;
}

function photoFor(assetId: string): DocumentRow {
  return {
    id: `doc-${assetId}`,
    asset_id: assetId,
    mime_type: 'image/jpeg',
    thumbnail_path: null
  } as unknown as DocumentRow;
}

function openReminder(id: string): ReminderRow {
  return { id, title: id, status: 'open', due_date: null } as unknown as ReminderRow;
}

const EMPTY = { roomCount: 0, utilities: [], assets: [], documents: [], reminders: [] };

/** What first-run setup produces: rooms, both shut-offs, systems, seeded care. */
const AFTER_WIZARD = {
  roomCount: 12,
  utilities: [
    utility('main_water_shutoff'),
    utility('electrical_panel'),
    utility('water_heater'),
    utility('furnace'),
    utility('smoke_detector')
  ],
  assets: [],
  documents: [],
  reminders: [openReminder('r1'), openReminder('r2')]
};

describe('the capture-punishing bug', () => {
  // This is the regression that motivated splitting the bands. Serials, values
  // and photos used to divide by the CURRENT asset count, so recording an
  // eleventh appliance you had no serial for made the number go DOWN — the
  // measure punished exactly the honesty the product wants.
  it('never lowers the score when another item is recorded without a serial', () => {
    const withOne = computeCompleteness({
      ...EMPTY,
      assets: [asset('a1', { serial_number: 'SN1' })]
    });

    const withTwo = computeCompleteness({
      ...EMPTY,
      assets: [asset('a1', { serial_number: 'SN1' }), asset('a2')]
    });

    expect(withTwo.score).toBeGreaterThanOrEqual(withOne.score);
  });

  it('is monotonic across a whole bulk capture run', () => {
    // A walk through the house: most items scanned without a legible serial.
    const assets: AssetRow[] = [];
    let previous = computeCompleteness({ ...EMPTY, assets: [] }).score;

    for (let index = 0; index < 25; index += 1) {
      assets.push(asset(`a${index}`, index % 5 === 0 ? { serial_number: `SN${index}` } : {}));
      const next = computeCompleteness({ ...EMPTY, assets: [...assets] }).score;
      expect(next, `score fell at item ${index + 1}`).toBeGreaterThanOrEqual(previous);
      previous = next;
    }
  });

  it('never lowers the score when an item is added without a value or a photo', () => {
    const before = computeCompleteness({
      ...EMPTY,
      assets: [asset('a1', { purchase_price: 100 })],
      documents: [photoFor('a1')]
    });

    const after = computeCompleteness({
      ...EMPTY,
      assets: [asset('a1', { purchase_price: 100 }), asset('a2')],
      documents: [photoFor('a1')]
    });

    expect(after.score).toBeGreaterThanOrEqual(before.score);
  });
});

describe('the essentials band', () => {
  it('is not sealed for an empty record', () => {
    expect(computeCompleteness(EMPTY).sealed).toBe(false);
  });

  // The old score showed a perfectly-onboarded person 25/100 and a list of
  // failures. Finishing setup has to actually finish something.
  it('is sealed by what first-run setup produces', () => {
    expect(computeCompleteness(AFTER_WIZARD).sealed).toBe(true);
  });

  it('stays sealed with no belongings recorded at all', () => {
    const result = computeCompleteness(AFTER_WIZARD);
    expect(result.sealed).toBe(true);
    expect(result.deepening.every((check) => !check.done)).toBe(true);
  });

  it('breaks the seal if any single essential is missing', () => {
    for (const id of ['rooms', 'water', 'electrical', 'systems', 'care']) {
      const input = { ...AFTER_WIZARD };

      if (id === 'rooms') input.roomCount = 0;
      if (id === 'care') input.reminders = [];
      if (id === 'water') {
        input.utilities = AFTER_WIZARD.utilities.filter(
          (u) => u.utility_type !== 'main_water_shutoff'
        );
      }
      if (id === 'electrical') {
        input.utilities = AFTER_WIZARD.utilities.filter(
          (u) => u.utility_type !== 'electrical_panel'
        );
      }
      if (id === 'systems') input.utilities = [];

      expect(computeCompleteness(input).sealed, `${id} did not break the seal`).toBe(false);
    }
  });

  it('accepts a breaker panel in place of an electrical panel', () => {
    const result = computeCompleteness({
      ...AFTER_WIZARD,
      utilities: [
        utility('main_water_shutoff'),
        utility('breaker_panel'),
        utility('water_heater'),
        utility('furnace')
      ]
    });
    expect(result.sealed).toBe(true);
  });

  it('contains exactly the five binary essentials', () => {
    const result = computeCompleteness(EMPTY);
    expect(result.essentials.map((check) => check.id)).toEqual([
      'rooms',
      'water',
      'electrical',
      'systems',
      'care'
    ]);
    for (const check of result.essentials) {
      expect(check.earned === 0 || check.earned === check.possible).toBe(true);
    }
  });
});

describe('the deepening band', () => {
  it('reports counts rather than fractions, so there is nothing to fall short of', () => {
    const result = computeCompleteness({
      ...EMPTY,
      assets: [asset('a1', { serial_number: 'SN1' }), asset('a2')]
    });

    for (const check of result.deepening) {
      expect(check.detail).not.toMatch(/\d+\s*\/\s*\d+/);
    }
  });

  it('counts what is there', () => {
    const result = computeCompleteness({
      ...EMPTY,
      assets: [asset('a1'), asset('a2'), asset('a3')]
    });
    expect(result.deepening.find((c) => c.id === 'inventory')?.detail).toBe('3 items');
  });

  it('uses the singular for one', () => {
    const result = computeCompleteness({ ...EMPTY, assets: [asset('a1')] });
    expect(result.deepening.find((c) => c.id === 'inventory')?.detail).toBe('1 item');
  });
});

describe('nextActions', () => {
  it('puts essentials ahead of the long tail', () => {
    const result = computeCompleteness({
      ...EMPTY,
      assets: Array.from({ length: 20 }, (_, i) => asset(`a${i}`))
    });

    expect(result.nextActions.every((action) => action.group === 'essentials')).toBe(true);
  });

  it('is empty once everything is done', () => {
    const complete = computeCompleteness({
      ...AFTER_WIZARD,
      assets: Array.from({ length: 12 }, (_, i) =>
        asset(`a${i}`, { serial_number: `SN${i}`, purchase_price: 10 })
      ),
      documents: [
        ...Array.from({ length: 12 }, (_, i) => photoFor(`a${i}`)),
        { id: 'd1' } as unknown as DocumentRow,
        { id: 'd2' } as unknown as DocumentRow,
        { id: 'd3' } as unknown as DocumentRow
      ]
    });

    expect(complete.nextActions).toEqual([]);
    expect(complete.score).toBe(100);
  });

  it('offers at most three', () => {
    expect(computeCompleteness(EMPTY).nextActions.length).toBeLessThanOrEqual(3);
  });
});

describe('score', () => {
  it('stays within bounds', () => {
    expect(computeCompleteness(EMPTY).score).toBe(0);
    expect(computeCompleteness(AFTER_WIZARD).score).toBeGreaterThan(0);
    expect(computeCompleteness(AFTER_WIZARD).score).toBeLessThanOrEqual(100);
  });

  // The old model gave a fully-onboarded person 25. The point of the re-cut is
  // that finishing setup is a real milestone, not a quarter of one.
  it('rewards finishing setup properly', () => {
    expect(computeCompleteness(AFTER_WIZARD).score).toBeGreaterThanOrEqual(50);
  });
});
