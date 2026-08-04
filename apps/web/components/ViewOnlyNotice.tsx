import { Card } from '@home-folder/ui';
import { describeRole } from '../lib/access';
import type { SharingRole } from '../lib/sharing';

/**
 * Stands where a write control would be, for somebody who cannot use it.
 *
 * Hiding the control outright would be worse: the person is left wondering
 * whether the feature exists, whether it is broken, or whether they missed
 * something. Saying "you have view-only access, here is who can change that"
 * answers all three, and answers them before they try rather than after the
 * save fails.
 */
export function ViewOnlyNotice({
  role,
  action,
  inline = false
}: {
  role: SharingRole | null;
  /** What they cannot do, e.g. "add utilities" — used in the sentence. */
  action: string;
  /** Render as a plain line rather than its own card. */
  inline?: boolean;
}) {
  const body = (
    <>
      <p style={{ margin: 0, fontWeight: 600 }}>You have {describeRole(role)} to this home</p>
      <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
        This home was shared with you, so you can look through everything the owner chose to
        share but not {action}. Ask whoever shared it to give you editing access if you need to
        make changes.
      </p>
    </>
  );

  if (inline) {
    return (
      <div
        role="note"
        style={{
          padding: '10px 12px',
          borderRadius: 'var(--radius-control)',
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface-muted, rgba(0,0,0,0.03))'
        }}
      >
        {body}
      </div>
    );
  }

  return <Card>{body}</Card>;
}
