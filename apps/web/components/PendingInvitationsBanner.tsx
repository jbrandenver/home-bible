import { useCallback, useEffect, useState } from 'react';
import { formatEnumLabel } from '@home-folder/shared';
import { Button, Card } from '@home-folder/ui';
import {
  acceptPendingInvitation,
  listPendingInvitationsForMe,
  type PendingInvitation
} from '../lib/sharing';

/**
 * Surfaces invitations addressed to the signed-in address.
 *
 * Accepting used to be possible only from the emailed link, because the token
 * exists nowhere else — so signing up, confirming an address, or simply
 * signing in from somewhere else left the recipient on the dashboard with no
 * route back except finding the original email. Since the app sends no
 * invitation email of its own, that route was often a message the owner had
 * pasted somewhere, and easy to lose.
 *
 * Renders nothing when there is nothing waiting, so it costs everyone else a
 * single RPC and no screen space.
 */
export function PendingInvitationsBanner({ onAccepted }: { onAccepted?: () => void }) {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    listPendingInvitationsForMe().then((rows) => {
      if (isMounted) setInvitations(rows);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAccept = useCallback(
    async (invitation: PendingInvitation) => {
      setBusyId(invitation.invitation_id);
      setError('');

      try {
        await acceptPendingInvitation(invitation.invitation_id);
        setAccepted((current) => [...current, invitation.property_nickname || 'the home']);
        setInvitations((current) =>
          current.filter((row) => row.invitation_id !== invitation.invitation_id)
        );
        onAccepted?.();
      } catch (acceptError) {
        setError(
          acceptError instanceof Error ? acceptError.message : 'Could not accept that invitation.'
        );
      } finally {
        setBusyId('');
      }
    },
    [onAccepted]
  );

  if (invitations.length === 0 && accepted.length === 0) {
    return null;
  }

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>
        {invitations.length > 0
          ? invitations.length === 1
            ? 'Someone shared their home with you'
            : `${invitations.length} people shared their homes with you`
          : 'Invitation accepted'}
      </h2>

      {accepted.length > 0 ? (
        <p style={{ color: 'var(--status-good)', marginTop: 0, fontWeight: 600 }}>
          You now have access to {accepted.join(', ')}. Use the switcher at the top to open it.
        </p>
      ) : null}

      {error ? (
        <p style={{ color: 'var(--status-urgent)', fontWeight: 700 }} role="alert">
          {error}
        </p>
      ) : null}

      {invitations.map((invitation) => (
        <div
          key={invitation.invitation_id}
          style={{ display: 'grid', gap: 8, marginBottom: 16 }}
        >
          <p style={{ margin: 0 }}>
            <strong>{invitation.property_nickname || 'A home'}</strong> — you were invited as{' '}
            {formatEnumLabel(invitation.role).toLowerCase()}. You will only see what that role
            allows.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button
              onClick={() => handleAccept(invitation)}
              disabled={busyId === invitation.invitation_id}
            >
              {busyId === invitation.invitation_id ? 'Accepting...' : 'Accept invitation'}
            </Button>
          </div>
        </div>
      ))}
    </Card>
  );
}
