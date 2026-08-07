import { describe, expect, it } from 'vitest';
import {
  DELETE_PHRASE,
  formatClosureDate,
  matchesDeletePhrase,
  resolveDeleteAction,
  type DeleteStep
} from '../lib/accountClosure';

// Closing an account is deliberately two confirmations for a paying customer:
// the record first, the money second. The ordering is the requirement, not a
// UI detail — confirming billing first would let someone cancel their plan and
// then abandon the deletion, leaving an account with no subscription.
describe('account closure flow', () => {
  const sub = { step: 'account' as DeleteStep, typed: DELETE_PHRASE, hasSubscription: true };
  const free = { step: 'account' as DeleteStep, typed: DELETE_PHRASE, hasSubscription: false };

  it('sends a subscriber to the billing step before deleting anything', () => {
    expect(resolveDeleteAction(sub)).toEqual({ action: 'advance', next: 'billing' });
  });

  it('never reaches the billing step for someone with no subscription', () => {
    expect(resolveDeleteAction(free)).toEqual({ action: 'delete' });
  });

  it('only deletes from the billing step once billing is confirmed', () => {
    expect(resolveDeleteAction({ ...sub, step: 'billing' })).toEqual({ action: 'delete' });
  });

  it('blocks every step until the phrase is typed', () => {
    for (const step of ['account', 'billing'] as DeleteStep[]) {
      expect(resolveDeleteAction({ step, typed: '', hasSubscription: true })).toEqual({
        action: 'blocked'
      });
      expect(resolveDeleteAction({ step, typed: 'delet', hasSubscription: true })).toEqual({
        action: 'blocked'
      });
    }
  });

  it('blocks clearing the phrase after advancing to billing', () => {
    // Guards the sequence account(typed) -> billing -> box cleared -> confirm.
    expect(resolveDeleteAction({ step: 'billing', typed: '', hasSubscription: true })).toEqual({
      action: 'blocked'
    });
  });

  it('does nothing at all when the flow is closed', () => {
    expect(
      resolveDeleteAction({ step: 'closed', typed: DELETE_PHRASE, hasSubscription: true })
    ).toEqual({ action: 'blocked' });
  });

  it('forgives case and surrounding whitespace but not other words', () => {
    expect(matchesDeletePhrase('delete')).toBe(true);
    expect(matchesDeletePhrase('  DeLeTe  ')).toBe(true);
    expect(matchesDeletePhrase('delete my account')).toBe(false);
    expect(matchesDeletePhrase('')).toBe(false);
  });
});

// The banner states the day the record goes. Someone deciding whether to
// change their mind is planning against a date, so a bad value must degrade to
// something still true rather than to "Invalid Date".
describe('closure date', () => {
  it('renders a real date', () => {
    const rendered = formatClosureDate('2026-09-08T01:21:18.000Z');
    expect(rendered).toMatch(/2026/);
    expect(rendered).not.toMatch(/Invalid/i);
  });

  it('falls back to plain words rather than showing Invalid Date', () => {
    expect(formatClosureDate('not-a-date')).toBe('the end of your billing period');
    expect(formatClosureDate('')).toBe('the end of your billing period');
  });
});
