import { describe, expect, it } from 'vitest';
import { describeDataError } from '../lib/errors';

// Every message a customer can see has to clear two bars:
//
//   1. It must not name a database object. "new row violates row-level
//      security policy for table utilities" reached a real person during
//      founder QA, and there is nothing they can do with that sentence.
//   2. It must not give advice that cannot work. The old production fallback
//      told everybody to "try again in a moment" — including a viewer who
//      lacks permission, who can retry forever and never succeed.
//
// These tests pin both, per category.

// Verbatim from production, 2026-08-04, seen by a viewer adding a utility.
const RLS = 'new row violates row-level security policy for table "utilities"';

const FORBIDDEN = [
  'row-level security',
  'violates',
  'constraint',
  'relation',
  'pgrst',
  'sqlstate',
  'null value in column',
  'duplicate key',
  'supabase',
  'postgres',
  'migration'
];

describe('customer-facing error messages', () => {
  it('explains a permission failure instead of naming the table', () => {
    const message = describeDataError('add a utility', RLS);

    expect(message).toContain('permission');
    expect(message).toContain('view-only');
    expect(message).toContain('add a utility');
    expect(message.toLowerCase()).not.toContain('utilities"');
  });

  it('never tells someone without permission to try again', () => {
    // The specific wrongness worth guarding: retrying is the one thing that
    // cannot possibly work here.
    expect(describeDataError('add a utility', RLS).toLowerCase()).not.toContain('try again');
  });

  it.each([
    ['permission denied for table assets'],
    ['insufficient privilege'],
    [RLS]
  ])('treats %s as a permission problem', (raw) => {
    expect(describeDataError('save this appliance', raw)).toContain('permission');
  });

  it.each([
    ['duplicate key value violates unique constraint "rooms_name_key"', 'already exists'],
    ['insert or update violates foreign key constraint "fk_room"', 'no longer there'],
    ['null value in column "title" violates not-null constraint', 'required detail is missing'],
    ['new row for relation "x" violates check constraint "y"', 'form we recognise'],
    ['invalid input syntax for type date', 'form we recognise'],
    ['JWT expired', 'session ended'],
    ['TypeError: Failed to fetch', 'connection']
  ])('translates %s', (raw, expected) => {
    expect(describeDataError('save this repair', raw)).toContain(expected);
  });

  it('passes our own plain-English messages through unchanged', () => {
    // Raised deliberately by our own functions — already written for a person,
    // so flattening them would lose real information.
    const ours = 'This invitation is for a different email address.';
    expect(describeDataError('accept this invitation', ours)).toBe(ours);
  });

  it('falls back to something calm when the cause is unrecognised', () => {
    const message = describeDataError('save this device', 'something entirely unexpected 0x1f');
    expect(message).toContain('save this device');
  });

  it('leaks no database vocabulary for any known failure', () => {
    const rawErrors = [
      RLS,
      'permission denied for table service_records',
      'duplicate key value violates unique constraint "x"',
      'insert or update on table "y" violates foreign key constraint "z"',
      'null value in column "title" of relation "issues" violates not-null constraint',
      'new row for relation "utilities" violates check constraint "utilities_type_check"',
      'invalid input syntax for type uuid: "abc"',
      'JWT expired',
      'PGRST301: schema cache reload required'
    ];

    for (const raw of rawErrors) {
      const message = describeDataError('save this', raw).toLowerCase();
      for (const banned of FORBIDDEN) {
        expect(message, `"${raw}" leaked "${banned}"`).not.toContain(banned);
      }
      // And it must actually say something.
      expect(message.length).toBeGreaterThan(20);
    }
  });
});
