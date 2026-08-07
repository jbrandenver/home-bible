import { describe, expect, it } from 'vitest';
import { collectKnownContacts, matchContact } from '../lib/contactSuggestions';

describe('collectKnownContacts', () => {
  it('returns nothing for no sources', () => {
    expect(collectKnownContacts([])).toEqual([]);
  });

  it('drops sources with no name', () => {
    expect(collectKnownContacts([{ phone: '555-0100' }, { name: '   ' }])).toEqual([]);
  });

  it('collapses the same person recorded in different places', () => {
    const contacts = collectKnownContacts([
      { name: 'Ace Plumbing', phone: '555-0100', at: '2026-01-01' },
      { name: '  ace plumbing ', phone: '555-0100', at: '2026-02-01' }
    ]);

    expect(contacts).toHaveLength(1);
    expect(contacts[0].name).toBe('Ace Plumbing');
  });

  it('treats repeated spaces as the same name', () => {
    expect(collectKnownContacts([{ name: 'Ace  Plumbing' }, { name: 'Ace Plumbing' }])).toHaveLength(1);
  });

  // The point of the whole thing: the number you used most recently.
  it('prefers the most recent details', () => {
    const contacts = collectKnownContacts([
      { name: 'Ace Plumbing', phone: '555-OLD', at: '2026-01-01' },
      { name: 'Ace Plumbing', phone: '555-NEW', at: '2026-06-01' }
    ]);

    expect(contacts[0].phone).toBe('555-NEW');
  });

  it('does not care what order the sources arrive in', () => {
    const forwards = collectKnownContacts([
      { name: 'Ace Plumbing', phone: '555-OLD', at: '2026-01-01' },
      { name: 'Ace Plumbing', phone: '555-NEW', at: '2026-06-01' }
    ]);
    const backwards = collectKnownContacts([
      { name: 'Ace Plumbing', phone: '555-NEW', at: '2026-06-01' },
      { name: 'Ace Plumbing', phone: '555-OLD', at: '2026-01-01' }
    ]);

    expect(forwards).toEqual(backwards);
  });

  // A newer record that only captured a phone must not erase an email that an
  // older one had.
  it('keeps a detail the newer record happens to lack', () => {
    const contacts = collectKnownContacts([
      { name: 'Ace Plumbing', phone: '555-0100', email: 'ace@example.com', at: '2026-01-01' },
      { name: 'Ace Plumbing', phone: '555-0200', at: '2026-06-01' }
    ]);

    expect(contacts[0].phone).toBe('555-0200');
    expect(contacts[0].email).toBe('ace@example.com');
  });

  it('prefers a dated record over an undated one', () => {
    const contacts = collectKnownContacts([
      { name: 'Ace Plumbing', phone: '555-DATED', at: '2026-01-01' },
      { name: 'Ace Plumbing', phone: '555-UNDATED' }
    ]);

    expect(contacts[0].phone).toBe('555-DATED');
  });

  it('turns blank details into nulls', () => {
    const [contact] = collectKnownContacts([{ name: 'Ace Plumbing', phone: '  ', email: '' }]);
    expect(contact.phone).toBeNull();
    expect(contact.email).toBeNull();
  });

  it('sorts by name', () => {
    const names = collectKnownContacts([
      { name: 'Zenith Electrical' },
      { name: 'Ace Plumbing' },
      { name: 'Meridian Roofing' }
    ]).map((contact) => contact.name);

    expect(names).toEqual(['Ace Plumbing', 'Meridian Roofing', 'Zenith Electrical']);
  });

  it('gathers people from every kind of record', () => {
    // repairs.contractor_*, service_records.provider_*, receipts.vendor_name
    const contacts = collectKnownContacts([
      { name: 'Ace Plumbing', phone: '555-0100', at: '2026-01-01' },
      { name: 'Zenith Electrical', email: 'z@example.com', at: '2026-02-01' },
      { name: 'City Hardware', at: '2026-03-01' }
    ]);

    expect(contacts.map((c) => c.name)).toEqual(['Ace Plumbing', 'City Hardware', 'Zenith Electrical']);
  });
});

describe('matchContact', () => {
  const contacts = collectKnownContacts([
    { name: 'Ace Plumbing', phone: '555-0100', email: 'ace@example.com' },
    { name: 'Zenith Electrical', phone: '555-0200' }
  ]);

  it('matches ignoring case and spacing', () => {
    expect(matchContact('  ace   plumbing ', contacts)?.phone).toBe('555-0100');
  });

  // Quietly filling in the wrong plumber's number is worse than filling in
  // nothing, because nobody re-checks a populated field.
  it('does not match partially', () => {
    expect(matchContact('Ace', contacts)).toBeNull();
    expect(matchContact('Ace Plumbing Ltd', contacts)).toBeNull();
  });

  it('returns null for nothing typed', () => {
    expect(matchContact('', contacts)).toBeNull();
    expect(matchContact('   ', contacts)).toBeNull();
    expect(matchContact(null, contacts)).toBeNull();
  });

  it('returns null against an empty list', () => {
    expect(matchContact('Ace Plumbing', [])).toBeNull();
  });
});
