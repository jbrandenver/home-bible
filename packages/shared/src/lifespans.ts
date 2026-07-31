// Expected service lives for common home components and appliances.
//
// Source: InterNACHI's Standard Estimated Life Expectancy Chart for Homes —
// https://www.nachi.org/life-expectancy.htm — using the midpoint of each
// published range. These are PLANNING ESTIMATES, not guarantees: real life
// depends on usage, water quality, climate, and maintenance. The UI copy must
// present them as "expected life", never as a prediction of failure.
//
// Pure module: no imports, no I/O, safe for both the web app and tests.

export type LifespanEntry = {
  /** Expected service life in years (InterNACHI range midpoint). */
  years: number;
  /**
   * Lowercase substrings matched against an asset's name when the asset_type
   * itself is generic ('appliance', 'fixture', ...).
   */
  keywords: readonly string[];
};

/**
 * Keyed by category. Keys deliberately line up with UTILITY_TYPES values where
 * one exists ('water_heater', 'furnace', 'air_conditioner', 'sump_pump') so a
 * direct asset_type/utility_type lookup works before keyword matching.
 */
export const ASSET_LIFESPANS: Readonly<Record<string, LifespanEntry>> = {
  water_heater: { years: 10, keywords: ['water heater', 'hot water heater'] },
  tankless_water_heater: { years: 20, keywords: ['tankless'] },
  furnace: { years: 18, keywords: ['furnace'] }, // gas forced-air 15–20
  boiler: { years: 25, keywords: ['boiler'] },
  air_conditioner: { years: 13, keywords: ['air conditioner', 'central ac', 'central air', ' a/c'] }, // 12–15
  heat_pump: { years: 13, keywords: ['heat pump', 'mini split', 'mini-split'] },
  hvac_unit: { years: 15, keywords: ['hvac'] },
  thermostat: { years: 15, keywords: ['thermostat'] },
  dishwasher: { years: 9, keywords: ['dishwasher'] },
  refrigerator: { years: 13, keywords: ['refrigerator', 'fridge'] },
  freezer: { years: 11, keywords: ['freezer'] },
  range: { years: 14, keywords: ['range', 'stove', 'oven', 'cooktop'] }, // electric ~13–15
  range_hood: { years: 14, keywords: ['range hood', 'vent hood'] },
  microwave: { years: 9, keywords: ['microwave'] },
  washer: { years: 10, keywords: ['washer', 'washing machine'] },
  dryer: { years: 13, keywords: ['dryer'] },
  garbage_disposal: { years: 12, keywords: ['disposal', 'disposer'] },
  trash_compactor: { years: 6, keywords: ['trash compactor', 'compactor'] },
  dehumidifier: { years: 8, keywords: ['dehumidifier'] },
  humidifier: { years: 8, keywords: ['humidifier'] },
  water_softener: { years: 12, keywords: ['water softener', 'softener'] },
  sump_pump: { years: 10, keywords: ['sump pump'] },
  well_pump: { years: 12, keywords: ['well pump'] },
  garage_door_opener: { years: 12, keywords: ['garage door opener', 'garage opener'] },
  garage_door: { years: 22, keywords: ['garage door'] },
  smoke_detector: { years: 10, keywords: ['smoke detector', 'smoke alarm', 'carbon monoxide', 'co detector'] },
  roof_asphalt: { years: 20, keywords: ['asphalt shingle', 'asphalt roof', 'shingle roof', 'roof'] },
  gutters: { years: 25, keywords: ['gutter'] },
  deck: { years: 20, keywords: ['deck'] },
  water_filter: { years: 5, keywords: ['water filter', 'filtration'] },
  wine_cooler: { years: 9, keywords: ['wine cooler', 'wine fridge'] }
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Expected service life in years for an asset, or null when unknown.
 *
 * The asset_type is checked first (so a utility recorded as 'water_heater'
 * resolves without keyword games); generic types fall through to case-
 * insensitive keyword matching against the asset's name. Longer keywords are
 * preferred so "garage door opener" wins over "garage door".
 */
export function expectedLifespanYears(
  assetType: string | null | undefined,
  name: string | null | undefined
): number | null {
  if (assetType) {
    const direct = ASSET_LIFESPANS[normalizeKey(assetType)];
    if (direct) {
      return direct.years;
    }
  }

  if (!name || !name.trim()) {
    return null;
  }

  const haystack = ` ${name.toLowerCase()} `;
  let best: { years: number; keywordLength: number } | null = null;

  for (const entry of Object.values(ASSET_LIFESPANS)) {
    for (const keyword of entry.keywords) {
      if (haystack.includes(keyword) && (!best || keyword.length > best.keywordLength)) {
        best = { years: entry.years, keywordLength: keyword.length };
      }
    }
  }

  return best ? best.years : null;
}

export type LifespanStatus = {
  /** Age in years, fractional (365.25-day years). */
  ageYears: number;
  /** ageYears / expectedYears. */
  fraction: number;
  status: 'past_expected' | 'nearing' | 'within';
};

/** Parse a YYYY-MM-DD string as local midnight; null when invalid. */
function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) {
    return null;
  }

  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Where an asset sits against its expected life. Null when there is no usable
 * purchase date or no positive expectancy — callers should show nothing rather
 * than guess. 'nearing' begins at 80% of expected life (inclusive).
 */
export function lifespanStatus(
  purchaseDateIso: string | null | undefined,
  expectedYears: number,
  todayIso?: string
): LifespanStatus | null {
  if (!Number.isFinite(expectedYears) || expectedYears <= 0) {
    return null;
  }

  const purchased = parseDateOnly(purchaseDateIso);
  if (!purchased) {
    return null;
  }

  const today = (todayIso ? parseDateOnly(todayIso) : null) ?? new Date();
  const ageYears = (today.getTime() - purchased.getTime()) / (365.25 * 86_400_000);
  if (ageYears < 0) {
    // A future purchase date is a data-entry mistake, not a fresh appliance.
    return null;
  }

  const fraction = ageYears / expectedYears;
  const status: LifespanStatus['status'] =
    fraction >= 1 ? 'past_expected' : fraction >= 0.8 ? 'nearing' : 'within';

  return { ageYears, fraction, status };
}
