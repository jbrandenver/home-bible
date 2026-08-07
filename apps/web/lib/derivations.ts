// Things the app already knows and asks for anyway.
//
// Each function here removes a field, or removes a way for two fields to
// contradict each other. They are suggestions, not overrides: a form uses them
// to pre-fill, and a person can always disagree. Where a rule cannot tell, it
// returns null rather than guessing — a confidently wrong default is worse
// than an empty one, because nobody re-reads a field that looks filled in.

import type {
  DocumentType,
  IssueStatus,
  RepairStatus,
  TenancyStatus
} from '@home-folder/shared';

// ---------- documents ----------

/** Matches migration 007's backfill, which is the floor this must not go below. */
const UNTITLED_DOCUMENT = 'Untitled document';

/**
 * A readable title from a file name.
 *
 * Migration 007 already backfills `title` from `file_name` server-side, so the
 * upload form asking for it was asking for something the database would have
 * worked out. This tidies it a little further — an extension and a run of
 * underscores are artefacts of a filesystem, not of a document.
 */
export function documentTitleFromFileName(fileName: unknown): string {
  if (typeof fileName !== 'string') {
    return UNTITLED_DOCUMENT;
  }

  const base = fileName
    .trim()
    .replace(/^.*[/\\]/, '')
    .replace(/\.[A-Za-z0-9]{1,8}$/, '');

  const cleaned = base
    .replace(/[_+]+/g, ' ')
    // Only hyphens *between* words: "AC-3000" is a model number, not two words.
    .replace(/(?<=[A-Za-z])-(?=[A-Za-z])/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return UNTITLED_DOCUMENT;
  }

  // Sentence case, and only when the name is not already deliberately cased —
  // "HVAC service report" must not become "Hvac service report".
  const first = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return first;
}

/**
 * Ordered most-specific-first: "warranty receipt" is a receipt only if nothing
 * more particular matched, and the first rule to hit wins.
 */
const DOCUMENT_TYPE_RULES: ReadonlyArray<{ type: DocumentType; pattern: RegExp }> = [
  { type: 'inspection_report', pattern: /\binspect/i },
  { type: 'compliance_certificate', pattern: /\b(certificate|compliance|gas safe|eicr)\b/i },
  { type: 'service_report', pattern: /\b(service|maintenance)\b/i },
  { type: 'warranty', pattern: /\b(warrant|guarantee)/i },
  { type: 'manual', pattern: /\b(manual|handbook|instructions|user guide)\b/i },
  { type: 'permit', pattern: /\bpermit\b/i },
  { type: 'insurance', pattern: /\b(insurance|policy)\b/i },
  { type: 'invoice', pattern: /\binvoice\b/i },
  { type: 'quote', pattern: /\b(quote|quotation|estimate)\b/i },
  { type: 'receipt', pattern: /\breceipt\b/i },
  {
    type: 'property_document',
    pattern: /\b(deed|title|closing|mortgage|survey|lease|completion)\b/i
  }
];

/**
 * A best guess at what was just uploaded, from the file name and mime type.
 *
 * Nineteen options in a dropdown is a lot to read when you already know what
 * you dragged in. Returns null when nothing matches, so the form can leave the
 * field for the person rather than defaulting to a wrong-but-plausible type.
 */
export function documentTypeFromFile(
  fileName: unknown,
  mimeType?: unknown
): DocumentType | null {
  const name = typeof fileName === 'string' ? fileName : '';

  for (const rule of DOCUMENT_TYPE_RULES) {
    if (rule.pattern.test(name)) {
      return rule.type;
    }
  }

  // Only after the name has had its say: a file called "boiler-manual.jpg" is
  // a manual that happens to be photographed, not a photo.
  if (typeof mimeType === 'string' && mimeType.startsWith('image/')) {
    return 'photo';
  }

  return null;
}

// ---------- bulk capture ----------

/**
 * A name for an item scanned from its data plate.
 *
 * A plate gives a make and a model, never "Kitchen fridge". Assembling what it
 * did read beats leaving the required field empty, and it is far easier to
 * correct a name than to invent one for the eleventh identical photo. Returns
 * null when the plate yielded nothing, so the caller can ask.
 */
export function draftAssetNameFrom(brand: unknown, model: unknown): string | null {
  const parts = [brand, model]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);

  return parts.length > 0 ? parts.join(' ') : null;
}

// ---------- status implied by dates ----------

function hasDate(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * What the dates say a repair's status is.
 *
 * The form asks for a completed date *and* a status, which lets someone save a
 * repair marked "open" that also completed last Tuesday. Null means the dates
 * imply nothing and whatever the person chose stands.
 */
export function impliedRepairStatus(
  completedDate: unknown,
  scheduledDate?: unknown
): RepairStatus | null {
  if (hasDate(completedDate)) {
    return 'completed';
  }
  if (hasDate(scheduledDate)) {
    return 'scheduled';
  }
  return null;
}

/** The same contradiction on issues: a resolved date with an open status. */
export function impliedIssueStatus(resolvedDate: unknown): IssueStatus | null {
  return hasDate(resolvedDate) ? 'resolved' : null;
}

/**
 * Whether a chosen status contradicts the dates badly enough to correct.
 *
 * Deliberately narrow. It only fires when a date says "finished" and the
 * status says otherwise — never the reverse, because someone marking a job
 * complete before filling the date in is doing something reasonable.
 */
export function repairStatusNeedsCorrection(
  current: unknown,
  completedDate: unknown
): boolean {
  return hasDate(completedDate) && current !== 'completed' && current !== 'cancelled';
}

// ---------- recurring obligations ----------

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

/**
 * When something is next due, from when it was last done and how often.
 *
 * The compliance form asks for all three and lets them disagree. Month
 * arithmetic clamps rather than overflowing: 31 January plus one month is
 * 28 February, not 3 March.
 */
export function nextDueFrom(lastCompletedOn: unknown, frequencyMonths: unknown): string | null {
  const start = parseDateOnly(lastCompletedOn);
  const months =
    typeof frequencyMonths === 'number' && Number.isFinite(frequencyMonths)
      ? Math.floor(frequencyMonths)
      : null;

  if (!start || months === null || months <= 0) {
    return null;
  }

  const shifted = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const lastDayOfTarget = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();

  return toDateString(
    new Date(shifted.getFullYear(), shifted.getMonth(), Math.min(start.getDate(), lastDayOfTarget))
  );
}

// ---------- tenancies ----------

/**
 * A tenancy's status is its dates. The enum is literally upcoming | active |
 * ended, and the form asks for it alongside the two dates that determine it.
 */
export function tenancyStatusForDates(
  startDate: unknown,
  endDate: unknown,
  today: Date
): TenancyStatus {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (end && end < now) {
    return 'ended';
  }
  if (start && start > now) {
    return 'upcoming';
  }
  return 'active';
}
