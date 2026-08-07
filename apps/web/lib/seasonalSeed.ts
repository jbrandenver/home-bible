// Choosing the first reminders a new home gets.
//
// The seasonal plan is twelve months of tasks. Writing all of them at signup
// would put ~25 reminders on a record whose owner has entered nothing yet:
// it would swamp computeDigest (which shows 8), and a wall of chores on day
// one reads as nagging, which the product explicitly refuses.
//
// So: the two nearest, and a link to the rest.
//
// The horizon is 35 days on purpose — it matches build_user_digest's monthly
// window (migration 021). A reminder seeded 50 days out would not appear in
// the first digest at all, which would defeat the point of seeding it: the
// payoff is meant to arrive before anyone has done any inventory work.
//
// Pure, and `today` is a parameter rather than a call to new Date(), so the
// selection is assertable.

import type { SeasonalMonth } from './seasonalPlan';

export type SeededReminder = {
  title: string;
  description: string;
  due_date: string;
  /** 1–12, the plan month this came from. */
  month: number;
};

export const DEFAULT_SEED_MAX = 2;

/** Matches build_user_digest's monthly look-ahead. */
export const DEFAULT_SEED_HORIZON_DAYS = 35;

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function atLocalMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * When a plan month falls due.
 *
 * Mirrors dueDateForMonth in maintenance.tsx: the 15th of the month, rolled
 * into next year if that month has passed, and never in the past. Kept
 * identical so a task seeded here and the same task added by hand from
 * /maintenance land on the same date.
 */
export function seasonalDueDate(month: number, today: Date): string {
  const start = atLocalMidnight(today);
  const year = month < start.getMonth() + 1 ? start.getFullYear() + 1 : start.getFullYear();
  const mid = new Date(year, month - 1, 15);
  return toDateString(mid < start ? start : mid);
}

function daysBetween(fromDateString: string, today: Date): number {
  const [year, month, day] = fromDateString.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  return Math.round((target.getTime() - atLocalMidnight(today).getTime()) / DAY_MS);
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

/**
 * The first reminders to write, soonest first.
 *
 * `existingTitles` is whatever the record already holds, so re-running the
 * wizard — or arriving here after adding tasks by hand on /maintenance —
 * cannot create a second copy. That mirrors the idempotency check in
 * maintenance.tsx, which matches on title plus a 'system_suggestion' source.
 */
export function selectSeedReminders(
  plan: ReadonlyArray<SeasonalMonth>,
  today: Date,
  existingTitles: ReadonlyArray<string> = [],
  options: { max?: number; horizonDays?: number } = {}
): SeededReminder[] {
  const max = options.max ?? DEFAULT_SEED_MAX;
  const horizonDays = options.horizonDays ?? DEFAULT_SEED_HORIZON_DAYS;

  if (max <= 0) {
    return [];
  }

  const taken = new Set(existingTitles.map(normalizeTitle));
  const candidates: SeededReminder[] = [];

  for (const entry of plan) {
    for (const task of entry.tasks) {
      const key = normalizeTitle(task.title);
      if (taken.has(key)) {
        continue;
      }

      const dueDate = seasonalDueDate(entry.month, today);
      const daysOut = daysBetween(dueDate, today);

      // Never seed something already overdue, and never something past the
      // window the first digest can see.
      if (daysOut < 0 || daysOut > horizonDays) {
        continue;
      }

      taken.add(key);
      candidates.push({
        title: task.title,
        // The trailing sentence matches what /maintenance writes, so the two
        // routes to the same reminder read identically.
        description: `${task.why} (From your seasonal plan.)`,
        due_date: dueDate,
        month: entry.month
      });
    }
  }

  return candidates
    .sort((a, b) => (a.due_date === b.due_date ? a.month - b.month : a.due_date.localeCompare(b.due_date)))
    .slice(0, max);
}
