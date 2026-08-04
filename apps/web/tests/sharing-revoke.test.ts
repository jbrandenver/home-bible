import { describe, expect, it } from 'vitest';
import { describeInvitationRevokeMiss } from '../lib/sharing';

// Regression test for the founder-found live bug (2026-08-04): revoking an
// invitation from a stale list after the invitee had already accepted matched
// zero rows, PostgREST reported success, the UI said "Invitation revoked.",
// and the viewer kept full read access. A zero-row guarded write is a failure
// and its message must say what is actually true — these cover the messages.

const BASE = {
  accepted_at: null as string | null,
  revoked_at: null as string | null,
  invited_email: 'spinningsirendesigns@gmail.com' as string | null
};

describe('describeInvitationRevokeMiss', () => {
  it('says the invitation is gone when it cannot be re-read', () => {
    expect(describeInvitationRevokeMiss(null)).toMatch(/no longer exists/i);
  });

  it('points at member removal when the invitation was already accepted', () => {
    const message = describeInvitationRevokeMiss({
      ...BASE,
      accepted_at: '2026-08-04T20:00:22.000Z'
    });
    expect(message).toMatch(/already accepted/i);
    expect(message).toMatch(/already has access/i);
    expect(message).toMatch(/People with access/);
    expect(message).toContain('spinningsirendesigns@gmail.com');
  });

  it('never claims the revoke worked in the accepted case', () => {
    const message = describeInvitationRevokeMiss({
      ...BASE,
      accepted_at: '2026-08-04T20:00:22.000Z'
    });
    expect(message).not.toMatch(/revoked\.$/i);
    expect(message).not.toMatch(/access (was|has been) removed/i);
  });

  it('handles an accepted open invitation with no email on file', () => {
    const message = describeInvitationRevokeMiss({
      ...BASE,
      accepted_at: '2026-08-04T20:00:22.000Z',
      invited_email: null
    });
    expect(message).toMatch(/the person who accepted it/i);
    expect(message).toMatch(/People with access/);
  });

  it('accepted wins over revoked when both are set', () => {
    // Acceptance is the state that grants access; that is the fact that matters.
    const message = describeInvitationRevokeMiss({
      ...BASE,
      accepted_at: '2026-08-04T20:00:22.000Z',
      revoked_at: '2026-08-04T21:00:00.000Z'
    });
    expect(message).toMatch(/already accepted/i);
  });

  it('says already revoked when someone else got there first', () => {
    const message = describeInvitationRevokeMiss({
      ...BASE,
      revoked_at: '2026-08-04T21:00:00.000Z'
    });
    expect(message).toMatch(/already revoked/i);
  });

  it('asks for a refresh when the miss has no visible cause', () => {
    expect(describeInvitationRevokeMiss({ ...BASE })).toMatch(/refresh/i);
  });
});
