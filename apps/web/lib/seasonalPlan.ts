// Deterministic seasonal maintenance plan — $0 to run.
//
// A pure rules engine: the home profile (climate band from the property's
// state, yard, basement, utilities, assets) goes in, a 12-month task plan
// comes out. No network calls, no model, no randomness — the same profile
// always produces the same plan, which is what makes it testable and free.

export type ClimateBand = 'cold' | 'mixed' | 'hot';

export type SeasonalPlanInput = {
  /** Two-letter code or full state name; unknown/absent falls back to 'mixed'. */
  state?: string | null;
  hasYard: boolean;
  hasBasement: boolean;
  /** utility_type values present on the property (e.g. 'sump_pump'). */
  utilityTypes: string[];
  /** asset_type values present on the property (e.g. 'appliance'). */
  assetTypes: string[];
};

export type SeasonalTask = {
  title: string;
  /** One line on why this matters — shown under the title. */
  why: string;
  /** Hint for linking the task to an existing record. */
  linkedType?: 'utility' | 'asset';
  /** Search keyword for finding the linked record. */
  keyword?: string;
};

export type SeasonalMonth = {
  /** 1–12 */
  month: number;
  tasks: SeasonalTask[];
};

// Coarse climate bands by state — this drives winterization timing, not
// weather forecasting, so coarse is the point.
const COLD_STATES = new Set([
  'AK', 'CO', 'CT', 'IA', 'ID', 'IL', 'MA', 'ME', 'MI', 'MN', 'MT', 'ND',
  'NE', 'NH', 'NY', 'RI', 'SD', 'UT', 'VT', 'WI', 'WY'
]);

const HOT_STATES = new Set([
  'AL', 'AZ', 'CA', 'FL', 'GA', 'HI', 'LA', 'MS', 'SC', 'TX'
]);

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI',
  minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY'
};

export function climateBandForState(state: string | null | undefined): ClimateBand {
  const cleaned = (state ?? '').trim();
  if (!cleaned) {
    return 'mixed';
  }

  const code =
    cleaned.length === 2 ? cleaned.toUpperCase() : STATE_NAME_TO_CODE[cleaned.toLowerCase()] ?? '';

  if (COLD_STATES.has(code)) return 'cold';
  if (HOT_STATES.has(code)) return 'hot';
  return 'mixed';
}

type Rule = SeasonalTask & {
  months: number[];
  applies?: (input: SeasonalPlanInput, band: ClimateBand) => boolean;
};

function hasUtility(input: SeasonalPlanInput, ...types: string[]) {
  return types.some((type) => input.utilityTypes.includes(type));
}

function hasAsset(input: SeasonalPlanInput, ...types: string[]) {
  return types.some((type) => input.assetTypes.includes(type));
}

// ~20 rules. Rules with no `applies` run for every home; the rest key off the
// profile. Every month keeps at least one unconditional task so the plan is
// never empty, even for a sparsely documented home.
const RULES: Rule[] = [
  {
    months: [1, 4, 7, 10],
    title: 'Replace the HVAC filter',
    why: 'A clogged filter makes heating and cooling work harder and wear out sooner.',
    linkedType: 'utility',
    keyword: 'hvac'
  },
  {
    months: [3, 11],
    title: 'Test smoke and CO alarms',
    why: 'Clock-change weekends are the easy reminder — dead batteries are the top cause of alarm failure.',
    linkedType: 'utility',
    keyword: 'smoke'
  },
  {
    months: [3],
    title: 'Test the sump pump',
    why: 'Spring melt and rain arrive together — find a stuck float now, not during a flood.',
    linkedType: 'utility',
    keyword: 'sump',
    applies: (input) => input.hasBasement
  },
  {
    months: [4, 10],
    title: 'Clear gutters and downspouts',
    why: 'Overflowing gutters send water straight down the walls and into the foundation.',
    applies: (input) => input.hasYard
  },
  {
    months: [10, 11],
    title: 'Winterize outdoor faucets (hose bibs)',
    why: 'A frozen hose bib splits the pipe inside the wall — disconnect hoses and drain before the first hard freeze.',
    applies: (_input, band) => band === 'cold'
  },
  {
    months: [10],
    title: 'Blow out and shut down the irrigation system',
    why: 'Water left in irrigation lines freezes and cracks them underground, where repairs are expensive.',
    linkedType: 'utility',
    keyword: 'irrigation',
    applies: (input, band) => band === 'cold' && hasUtility(input, 'irrigation_shutoff')
  },
  {
    months: [9],
    title: 'Flush the water heater',
    why: 'Sediment buildup steals capacity and shortens the tank’s life — an annual flush is the cheapest fix.',
    linkedType: 'utility',
    keyword: 'water heater'
  },
  {
    months: [1],
    title: 'Vacuum the refrigerator coils',
    why: 'Dusty coils make the compressor run hot, which is the part that fails first.',
    linkedType: 'asset',
    keyword: 'refrigerator'
  },
  {
    months: [1],
    title: 'Check the roofline for ice dams and heavy icicles',
    why: 'Ice dams push meltwater under shingles and into ceilings — catching them early keeps water outside.',
    applies: (_input, band) => band === 'cold'
  },
  {
    months: [2],
    title: 'Test GFCI outlets',
    why: 'Press test/reset on kitchen, bath, and outdoor outlets — a failed GFCI can’t protect against shock.',
    linkedType: 'utility',
    keyword: 'electrical'
  },
  {
    months: [4],
    title: 'Have the AC serviced before cooling season',
    why: 'A pre-season tune-up beats an emergency call during the first heat wave, in both price and wait time.',
    linkedType: 'utility',
    keyword: 'air',
    applies: (input, band) => band === 'hot' || hasUtility(input, 'air_conditioner', 'hvac_unit')
  },
  {
    months: [4],
    title: 'Spring walk-around: roof, siding, and foundation',
    why: 'Ten minutes from the ground catches winter damage while it is still a small repair.'
  },
  {
    months: [5],
    title: 'Check and re-caulk exterior gaps around windows and doors',
    why: 'Failed caulk lets water into the framing all summer — a tube of sealant now beats rot later.'
  },
  {
    months: [6],
    title: 'Clean bathroom exhaust fan covers',
    why: 'A dusty fan can’t clear moisture, and damp bathrooms grow mold.'
  },
  {
    months: [7],
    title: 'Deep-clean kitchen drains and the garbage disposal',
    why: 'Grease buildup narrows drains slowly — a summer flush keeps the line clear before holiday cooking.'
  },
  {
    months: [8],
    title: 'Inspect washing machine hoses',
    why: 'Burst supply hoses are among the most common water-damage claims — replace any showing bulges or cracks.',
    linkedType: 'asset',
    keyword: 'washer'
  },
  {
    months: [9],
    title: 'Have the furnace or boiler serviced before heating season',
    why: 'Heating failures cluster in the first cold week — a fall service visit skips the queue.',
    linkedType: 'utility',
    keyword: 'furnace',
    applies: (input, band) => band !== 'hot' || hasUtility(input, 'furnace', 'hvac_unit')
  },
  {
    months: [10],
    title: 'Clean the dryer vent duct',
    why: 'Lint in the vent duct is a leading cause of house fires — and a clear duct dries loads faster.',
    linkedType: 'asset',
    keyword: 'dryer',
    applies: (input) => hasAsset(input, 'appliance')
  },
  {
    months: [11],
    title: 'Check weatherstripping and door sweeps for drafts',
    why: 'Drafts are the cheapest heating loss to fix — a strip of foam pays for itself in one season.',
    applies: (_input, band) => band !== 'hot'
  },
  {
    months: [12],
    title: 'Check fire extinguisher pressure and expiration',
    why: 'An extinguisher only counts if the gauge is in the green when you reach for it.'
  }
];

/**
 * Build the 12-month plan for a home profile. Always returns exactly 12
 * entries (months 1–12, in order); task order within a month follows the
 * rules table, so it is stable across runs.
 */
export function buildSeasonalPlan(input: SeasonalPlanInput): SeasonalMonth[] {
  const band = climateBandForState(input.state);

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const tasks = RULES.filter(
      (rule) => rule.months.includes(month) && (!rule.applies || rule.applies(input, band))
    ).map(({ title, why, linkedType, keyword }) => ({
      title,
      why,
      ...(linkedType ? { linkedType } : {}),
      ...(keyword ? { keyword } : {})
    }));

    return { month, tasks };
  });
}
