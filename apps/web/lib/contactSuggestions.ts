// The same plumber, typed in again.
//
// There is no contacts table. The person who fixed the boiler is recorded as
// repairs.contractor_name/phone/email, again as service_records.provider_*
// (and again in that table's legacy vendor_* twin), again as
// receipts.vendor_name, again as condition_reports.conducted_by, and again as
// automation_devices.installer. Nothing joins them, so every job means
// re-keying a name and a phone number that are already on file three times.
//
// A real contacts table is the right answer eventually. This is the ninety
// percent of the value that needs no migration: gather the names already
// recorded, offer them, and fill in the number from the most recent time.

export type ContactSource = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  /** ISO timestamp or date. Used only to decide which record is most recent. */
  at?: string | null;
};

export type KnownContact = {
  name: string;
  phone: string | null;
  email: string | null;
};

function cleaned(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Everyone already named across the record, most recent details winning.
 *
 * Sorted by name so the datalist reads as a list rather than as history.
 * A source with no name is dropped: a phone number nobody is attached to is
 * not a contact.
 */
/**
 * Which spelling of a name to show.
 *
 * Recency decides the phone number, but it must not decide the casing: a
 * hurried "ace plumbing" typed last week should not replace "Ace Plumbing" in
 * a list somebody reads. Prefer whichever looks deliberately cased; on a tie,
 * keep what was seen first so the list is stable.
 */
function preferredName(current: string, candidate: string): string {
  const currentCased = /[A-Z]/.test(current);
  const candidateCased = /[A-Z]/.test(candidate);

  if (currentCased === candidateCased) return current;
  return currentCased ? current : candidate;
}

export function collectKnownContacts(sources: ReadonlyArray<ContactSource>): KnownContact[] {
  const byName = new Map<string, KnownContact & { at: string }>();

  for (const source of sources) {
    const name = cleaned(source.name);
    if (!name) continue;

    const key = normalize(name);
    // An absent timestamp sorts earliest, so a dated record always beats an
    // undated one whichever order they arrive in.
    const at = cleaned(source.at) ?? '';
    const existing = byName.get(key);

    if (!existing) {
      byName.set(key, {
        name,
        at,
        phone: cleaned(source.phone),
        email: cleaned(source.email)
      });
      continue;
    }

    existing.name = preferredName(existing.name, name);

    if (at >= existing.at) {
      // Newer details win — but never blank out something it simply omitted.
      existing.phone = cleaned(source.phone) ?? existing.phone;
      existing.email = cleaned(source.email) ?? existing.email;
      existing.at = at;
    } else {
      existing.phone = existing.phone ?? cleaned(source.phone);
      existing.email = existing.email ?? cleaned(source.email);
    }
  }

  return Array.from(byName.values())
    .map(({ name, phone, email }) => ({ name, phone, email }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The contact a typed name refers to, or null.
 *
 * Exact match only, ignoring case and repeated spaces. Deliberately not fuzzy:
 * quietly filling in the wrong plumber's phone number is worse than filling in
 * nothing, because nobody re-checks a field that is already populated.
 */
export function matchContact(
  name: unknown,
  contacts: ReadonlyArray<KnownContact>
): KnownContact | null {
  const typed = cleaned(name);
  if (!typed) return null;

  const key = normalize(typed);
  return contacts.find((contact) => normalize(contact.name) === key) ?? null;
}
