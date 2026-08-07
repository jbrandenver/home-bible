/**
 * The order and the friction of closing an account.
 *
 * Kept out of the page so the rule can be asserted directly: a paying customer
 * confirms losing the record FIRST, and only then confirms ending the money.
 * Getting that backwards would mean someone cancels their billing and then
 * backs out of the deletion, leaving them with an account and no plan — the
 * opposite of what they asked for, and the kind of thing that only shows up in
 * a support ticket.
 *
 * The typed phrase is deliberate friction. Closing an account is not something
 * anyone should be able to do with one stray click, and a mis-tap on a phone
 * is exactly how it would otherwise happen.
 */

export type DeleteStep = 'closed' | 'account' | 'billing';

export const DELETE_PHRASE = 'DELETE';

/** Case- and whitespace-forgiving: the ceremony is the typing, not the pedantry. */
export function matchesDeletePhrase(typed: string): boolean {
  return typed.trim().toUpperCase() === DELETE_PHRASE;
}

/**
 * What confirming the current step should do.
 *
 * 'advance' moves to the next confirmation; 'delete' means every confirmation
 * is in and the deletion may run; 'blocked' means the step is not satisfied.
 */
export function resolveDeleteAction(input: {
  step: DeleteStep;
  typed: string;
  hasSubscription: boolean;
}): { action: 'blocked' } | { action: 'advance'; next: DeleteStep } | { action: 'delete' } {
  const { step, typed, hasSubscription } = input;

  if (step === 'closed') {
    return { action: 'blocked' };
  }

  if (step === 'account') {
    if (!matchesDeletePhrase(typed)) {
      return { action: 'blocked' };
    }
    // A subscriber still owes us the billing confirmation. Everyone else has
    // nothing further to agree to.
    return hasSubscription ? { action: 'advance', next: 'billing' } : { action: 'delete' };
  }

  // Reaching 'billing' at all means the account step was satisfied, and the
  // phrase is still required so that clearing the box mid-flow cannot leave a
  // live confirm button behind.
  return matchesDeletePhrase(typed) ? { action: 'delete' } : { action: 'blocked' };
}
