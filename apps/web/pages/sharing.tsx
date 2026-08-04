import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { formatEnumLabel } from '@home-folder/shared';
import { Button, Card, PageHeader, UtilityBadge } from '@home-folder/ui';
import {
  assignableRolesFor,
  canEditMember,
  createPropertyInvitation,
  listPropertyInvitations,
  listPropertyMembers,
  loadSharingPreview,
  removePropertyMember,
  revokePropertyInvitation,
  SHARING_ROLES,
  sharingSectionLabel,
  updatePropertyMemberRole,
  type InvitationRole,
  type PropertyInvitation,
  type PropertyMember,
  type PropertyMemberAccess,
  type SharingPreview,
  type SharingRole
} from '../lib/sharing';
import { getHandoverContext } from '../lib/handover';
import {
  createPropertyTransfer,
  formatTransferCode,
  listPropertyTransfers,
  revokePropertyTransfer,
  transferStatus,
  type PropertyTransferRow,
  type TransferKeepRole
} from '../lib/transfers';

type Linkable = {
  room_id?: string | null;
  asset_id?: string | null;
  utility_id?: string | null;
  repair_id?: string | null;
  service_record_id?: string | null;
  issue_id?: string | null;
  trend_flag_id?: string | null;
};

const fieldStyle = {
  padding: 10,
  borderRadius: 4,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)'
};

const subtleText = { color: 'var(--text-muted)' };
const darkSubtleText = { color: 'rgba(255,248,234,0.78)' };
const darkErrorText = { color: 'var(--text-inverse)', fontWeight: 700 };

const roleCopy: Record<SharingRole, string> = {
  owner: 'Planning preview for current owner-level safe access.',
  co_owner: 'Planning preview for broad co-owner safe access.',
  editor: 'Planning preview for editing-capable safe access.',
  viewer: 'Planning preview for read-only safe access.',
  maintenance_guest: 'Planning preview for scoped maintenance access.',
  buyer_preview: 'Planning preview for safe buyer handoff access.',
  insurance_view: 'Planning preview for insurance-oriented file details.'
};

const INVITABLE_ROLES = SHARING_ROLES.filter((role): role is InvitationRole => role !== 'owner');

const forbiddenSensitivePatterns = [
  /access\s*codes?/i,
  /lock\s*codes?/i,
  /garage\s*codes?/i,
  /safe\s*codes?/i,
  /alarm\s*codes?/i,
  /wi[-\s]?fi\s*passwords?/i,
  /wifi\s*passwords?/i,
  /hidden\s*keys?/i,
  /door\s*codes?/i,
  /keypad\s*codes?/i
];

function safeText(value: string | null | undefined, fallback = 'Hidden by privacy rule') {
  if (!value || !value.trim()) return null;
  return forbiddenSensitivePatterns.some((pattern) => pattern.test(value)) ? fallback : value.trim();
}

function safeFileName(value: string | null | undefined) {
  const fileName = safeText(value);
  if (!fileName || /^https?:\/\//i.test(fileName) || /^www\./i.test(fileName)) return null;
  return fileName;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatAmount(amount: number | null, currency: string) {
  if (amount === null) return 'Hidden';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    return `${currency || 'USD'} ${amount.toFixed(2)}`;
  }
}

function buildLookups(preview: SharingPreview) {
  return {
    rooms: new Map(preview.data.rooms.map((room) => [room.id, room.name])),
    assets: new Map(preview.data.assets.map((asset) => [asset.id, asset.name])),
    utilities: new Map(preview.data.utilities.map((utility) => [utility.id, utility.name])),
    repairs: new Map(preview.data.repairs.map((repair) => [repair.id, repair.title])),
    serviceRecords: new Map(preview.data.serviceRecords.map((record) => [record.id, record.service_title])),
    issues: new Map(preview.data.issues.map((issue) => [issue.id, issue.title])),
    trendFlags: new Map(preview.data.trendFlags.map((flag) => [flag.id, flag.title]))
  };
}

function linkedLabel(record: Linkable, lookups: ReturnType<typeof buildLookups>) {
  if (record.room_id) return lookups.rooms.get(record.room_id) || 'Room record';
  if (record.asset_id) return lookups.assets.get(record.asset_id) || 'Asset record';
  if (record.utility_id) return lookups.utilities.get(record.utility_id) || 'Utility record';
  if (record.repair_id) return lookups.repairs.get(record.repair_id) || 'Repair record';
  if (record.service_record_id) return lookups.serviceRecords.get(record.service_record_id) || 'Service History';
  if (record.issue_id) return lookups.issues.get(record.issue_id) || 'Issue record';
  if (record.trend_flag_id) return lookups.trendFlags.get(record.trend_flag_id) || 'Trend';
  return 'Property';
}

function roleLabel(role: SharingRole) {
  return role === 'co_owner' ? 'Co-owner' : formatEnumLabel(role);
}

export default function SharingPage() {
  const [selectedRole, setSelectedRole] = useState<SharingRole>('owner');
  const [inviteRole, setInviteRole] = useState<InvitationRole>('viewer');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [invitations, setInvitations] = useState<PropertyInvitation[]>([]);
  const [preview, setPreview] = useState<SharingPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [revokingId, setRevokingId] = useState('');
  const [error, setError] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');

  // People with access. The server decides what is permitted; this state only
  // reflects the answer so the page never offers a control that will be refused.
  const [memberAccess, setMemberAccess] = useState<PropertyMemberAccess | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const [memberError, setMemberError] = useState('');
  const [memberNotice, setMemberNotice] = useState('');
  const [savingMemberId, setSavingMemberId] = useState('');
  const [removingMemberId, setRemovingMemberId] = useState('');

  // Transfer ownership (migration 025). Only the property owner sees this
  // section — same signal the RPC enforces (properties.owner_user_id), read
  // from the shared handover context the rest of this page's data flows from.
  const [transferProperty, setTransferProperty] = useState<{
    id: string;
    nickname: string;
    isOwner: boolean;
    isUnit: boolean;
  } | null>(null);
  const [transfers, setTransfers] = useState<PropertyTransferRow[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [creatingTransfer, setCreatingTransfer] = useState(false);
  const [revokingTransferId, setRevokingTransferId] = useState('');
  const [transferEmail, setTransferEmail] = useState('');
  const [transferKeepRole, setTransferKeepRole] = useState<'' | TransferKeepRole>('');
  const [transferExpiryDays, setTransferExpiryDays] = useState('14');
  const [transferError, setTransferError] = useState('');
  const [transferNotice, setTransferNotice] = useState('');
  // The raw code lives only in this state, only until the page unmounts.
  const [createdTransfer, setCreatedTransfer] = useState<{
    code: string;
    expiresAt: string;
    claimUrl: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPreview() {
      setLoading(true);
      setError('');

      try {
        const nextPreview = await loadSharingPreview(selectedRole);
        if (isMounted) {
          setPreview(nextPreview);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load sharing preview.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [selectedRole]);

  useEffect(() => {
    let isMounted = true;

    async function loadInvites() {
      setInvitesLoading(true);
      setInviteError('');

      try {
        const nextInvitations = await listPropertyInvitations();
        if (isMounted) {
          setInvitations(nextInvitations);
        }
      } catch (loadError) {
        if (isMounted) {
          setInviteError(loadError instanceof Error ? loadError.message : 'Failed to load invitations.');
        }
      } finally {
        if (isMounted) {
          setInvitesLoading(false);
        }
      }
    }

    loadInvites();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadTransfers() {
      setTransfersLoading(true);
      setTransferError('');

      try {
        const context = await getHandoverContext();
        if (!isMounted) return;

        if (context.mode !== 'supabase' || !context.user || !context.property) {
          setTransferProperty(null);
          return;
        }

        const property = {
          id: context.property.id,
          nickname: context.property.nickname,
          isOwner: context.property.owner_user_id === context.user.id,
          isUnit: Boolean(context.property.parent_property_id)
        };
        setTransferProperty(property);

        if (property.isOwner) {
          const rows = await listPropertyTransfers(property.id);
          if (isMounted) {
            setTransfers(rows);
          }
        }
      } catch (loadError) {
        if (isMounted) {
          setTransferError(loadError instanceof Error ? loadError.message : 'Failed to load transfers.');
        }
      } finally {
        if (isMounted) {
          setTransfersLoading(false);
        }
      }
    }

    loadTransfers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadMembers() {
      setMembersLoading(true);
      setMemberError('');

      try {
        const access = await listPropertyMembers();
        if (isMounted) {
          setMemberAccess(access);
        }
      } catch (loadError) {
        if (isMounted) {
          setMemberError(loadError instanceof Error ? loadError.message : 'Failed to load the people with access.');
        }
      } finally {
        if (isMounted) {
          setMembersLoading(false);
        }
      }
    }

    loadMembers();

    return () => {
      isMounted = false;
    };
  }, []);

  const reloadMembers = async () => {
    setMemberAccess(await listPropertyMembers());
  };

  const changeMemberRole = async (member: PropertyMember, role: SharingRole) => {
    if (savingMemberId || removingMemberId) return;

    setSavingMemberId(member.id);
    setMemberError('');
    setMemberNotice('');

    try {
      await updatePropertyMemberRole(member.id, role);
      setMemberNotice(`${member.label} is now a ${roleLabel(role).toLowerCase()}.`);
      await reloadMembers();
    } catch (updateError) {
      // A refusal here is the database's role guard talking. Show what it said
      // rather than a guess about why.
      setMemberError(updateError instanceof Error ? updateError.message : 'Failed to change this person’s access.');
    } finally {
      setSavingMemberId('');
    }
  };

  const removeMember = async (member: PropertyMember) => {
    if (savingMemberId || removingMemberId) return;

    const confirmed = window.confirm(
      `Remove ${member.label} from this record? They lose access straight away. You can invite them again later.`
    );
    if (!confirmed) return;

    setRemovingMemberId(member.id);
    setMemberError('');
    setMemberNotice('');

    try {
      await removePropertyMember(member.id);
      setMemberNotice(`${member.label} no longer has access.`);
      await reloadMembers();
    } catch (removeError) {
      setMemberError(removeError instanceof Error ? removeError.message : 'Failed to remove this person.');
      // Reload so the list reflects what the database actually holds.
      try {
        await reloadMembers();
      } catch {
        // Keep the honest error on screen.
      }
    } finally {
      setRemovingMemberId('');
    }
  };

  const createTransfer = async (event: FormEvent) => {
    event.preventDefault();
    if (creatingTransfer || !transferProperty) return;

    const confirmed = window.confirm(
      `Create a transfer code for “${transferProperty.nickname}”? Whoever claims it becomes the owner of this entire record — the property, any units, and everything documented inside. Every existing share and open invitation is removed when they claim, and a claimed transfer cannot be undone.`
    );
    if (!confirmed) return;

    setCreatingTransfer(true);
    setTransferError('');
    setTransferNotice('');
    setCreatedTransfer(null);

    try {
      const created = await createPropertyTransfer({
        propertyId: transferProperty.id,
        recipientEmail: transferEmail || null,
        keepIssuerRole: transferKeepRole || null,
        expiresInSeconds: Number(transferExpiryDays) * 86400
      });
      setCreatedTransfer({
        code: created.transferCode,
        expiresAt: created.expiresAt,
        claimUrl: `${window.location.origin}/claim`
      });
      setTransfers(await listPropertyTransfers(transferProperty.id));
    } catch (createError) {
      setTransferError(createError instanceof Error ? createError.message : 'Failed to create the transfer.');
    } finally {
      setCreatingTransfer(false);
    }
  };

  const revokeTransfer = async (transferId: string) => {
    if (revokingTransferId || !transferProperty) return;

    const confirmed = window.confirm(
      'Revoke this transfer code? The code stops working immediately and the record stays with you.'
    );
    if (!confirmed) return;

    setRevokingTransferId(transferId);
    setTransferError('');
    setTransferNotice('');

    try {
      await revokePropertyTransfer(transferId);
      setTransferNotice('Transfer revoked. The code no longer works.');
      setTransfers(await listPropertyTransfers(transferProperty.id));
    } catch (revokeError) {
      setTransferError(revokeError instanceof Error ? revokeError.message : 'Failed to revoke the transfer.');
    } finally {
      setRevokingTransferId('');
    }
  };

  const createInvite = async (event: FormEvent) => {
    event.preventDefault();
    if (creatingInvite) return;

    setCreatingInvite(true);
    setInviteError('');
    setInviteNotice('');
    setInviteUrl('');

    try {
      const created = await createPropertyInvitation({
        role: inviteRole,
        invitedEmail: inviteEmail || null
      });
      setInviteUrl(created.inviteUrl);
      setInviteNotice(
        // Say plainly that nothing was emailed. "Send an invitation" that sends
        // nothing is a fair thing to misread, and the recipient waiting on an
        // email that will never arrive is the failure it causes.
        'Invitation link created. We do not email it — copy the link and send it yourself. If you set a recipient email, they can also just sign in with that address and accept from their dashboard.'
      );
      setInvitations(await listPropertyInvitations());
    } catch (createError) {
      setInviteError(createError instanceof Error ? createError.message : 'Failed to create invitation.');
    } finally {
      setCreatingInvite(false);
    }
  };

  const revokeInvite = async (invitationId: string) => {
    if (revokingId) return;

    setRevokingId(invitationId);
    setInviteError('');
    setInviteNotice('');

    try {
      await revokePropertyInvitation(invitationId);
      setInviteNotice('Invitation revoked.');
      setInvitations(await listPropertyInvitations());
    } catch (revokeError) {
      setInviteError(revokeError instanceof Error ? revokeError.message : 'Failed to revoke invitation.');
      // A zero-row revoke means this page was showing a stale invitation —
      // reload so the list stops offering a button the database will ignore.
      try {
        setInvitations(await listPropertyInvitations());
        await reloadMembers();
      } catch {
        // The error message above is already honest; keep it on screen.
      }
    } finally {
      setRevokingId('');
    }
  };

  const modeLabel = preview?.mode === 'supabase' ? 'Saved to your account.' : 'Demo data is stored only in this browser.';

  return (
    <>
      <PageHeader
        title="Sharing"
        description="Invite trusted people with role-scoped access, then preview what each role can see."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card tone="dark">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <UtilityBadge label={modeLabel} />
            {preview?.propertyName ? <UtilityBadge label={preview.propertyName} /> : null}
            <UtilityBadge label="Invite links enabled" />
          </div>

          <p style={{ color: 'rgba(255,248,234,0.78)', marginTop: 0 }}>
            Invite links are single-use, expiring tokens. Access is granted only after the recipient signs in and accepts.
          </p>
          <p style={{ color: 'rgba(255,248,234,0.78)', marginTop: 0 }}>
            Privacy reminder: sensitive entry details, passwords, and private personal archive records are not included for scoped guest roles.
          </p>

          {loading ? <p style={darkSubtleText}>Loading sharing preview...</p> : null}
          {error ? <p style={darkErrorText}>{error}</p> : null}

          {!loading && preview && !preview.propertyName ? (
            <div style={{ border: '1px solid rgba(224,189,131,0.45)', background: 'rgba(236,226,207,0.08)', borderRadius: 6, padding: 14 }}>
              <strong>No property found yet.</strong>
              <p style={{ color: 'rgba(255,248,234,0.78)', marginBottom: 0 }}>
                {preview.mode === 'supabase'
                  ? 'Create or join a property before reviewing access.'
                  : 'Demo data is stored only in this browser. Add a demo property and rooms first to preview sample access.'}
              </p>
            </div>
          ) : null}
        </Card>

        {/* Shown only to owners and co-owners — the same people the database
            lets manage members. Errors surface here too, so a failed check is
            never silent. */}
        {membersLoading || memberError || (memberAccess?.canManage ?? false) ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>People with access</h2>
            <p style={subtleText}>
              Everyone who can open this record today. Change what someone can do, or take their access away.
            </p>

            {membersLoading ? <p style={subtleText}>Loading people with access...</p> : null}

            {!membersLoading && memberAccess && memberAccess.members.length === 0 ? (
              <p style={subtleText}>Nobody else has access yet. Invitations you send appear here once accepted.</p>
            ) : null}

            <div style={{ display: 'grid', gap: 12 }}>
              {(memberAccess?.members ?? []).map((member) => {
                const editable = memberAccess ? canEditMember(memberAccess, member) : false;
                const roleOptions = memberAccess ? assignableRolesFor(memberAccess) : [];
                const busy = savingMemberId === member.id || removingMemberId === member.id;

                return (
                  <div
                    key={member.id}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      padding: 12,
                      display: 'flex',
                      gap: 12,
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong>
                        {member.label}
                        {member.isYou ? ' (you)' : ''}
                      </strong>
                      <div style={subtleText}>
                        {roleLabel(member.role)}
                        {member.isPropertyOwner ? ' · owns this record' : ''}
                        {' · Added '}
                        {formatDate(member.created_at)}
                      </div>
                    </div>

                    {editable ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span style={{ ...subtleText, fontSize: 13 }}>Access level</span>
                          <select
                            value={member.role}
                            disabled={busy}
                            aria-label={`Access level for ${member.label}`}
                            onChange={(event) => changeMemberRole(member, event.target.value as SharingRole)}
                            style={fieldStyle}
                          >
                            {/* The person's current role stays selectable even
                                when the caller could not grant it themselves. */}
                            {(roleOptions.includes(member.role as (typeof roleOptions)[number])
                              ? roleOptions
                              : [member.role, ...roleOptions]
                            ).map((role) => (
                              <option key={role} value={role}>{roleLabel(role)}</option>
                            ))}
                          </select>
                        </label>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy}
                          aria-label={`Remove ${member.label}`}
                          onClick={() => removeMember(member)}
                        >
                          {removingMemberId === member.id ? 'Removing...' : 'Remove'}
                        </Button>
                      </div>
                    ) : (
                      <span style={{ ...subtleText, fontSize: 13 }}>
                        {member.isPropertyOwner
                          ? 'Ownership moves through a transfer, not from here.'
                          : 'Only the owner can change this.'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {memberNotice ? <p style={{ margin: '12px 0 0', color: 'var(--status-good)' }}>{memberNotice}</p> : null}
            {memberError ? <p style={{ margin: '12px 0 0', color: 'var(--status-urgent)' }}>{memberError}</p> : null}
          </Card>
        ) : null}

        <Card>
          <h2 style={{ marginTop: 0 }}>Invite someone</h2>
          <form onSubmit={createInvite} style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Role</span>
                <select
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as InvitationRole)}
                  style={fieldStyle}
                >
                  {INVITABLE_ROLES.map((role) => (
                    <option key={role} value={role}>{roleLabel(role)}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Recipient email (optional)</span>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="name@example.com"
                  style={fieldStyle}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button type="submit" disabled={creatingInvite}>
                {creatingInvite ? 'Creating...' : 'Create invite link'}
              </Button>
              {inviteUrl ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(inviteUrl);
                    setInviteNotice('Invitation link copied.');
                  }}
                >
                  Copy link
                </Button>
              ) : null}
            </div>

            {inviteUrl ? (
              <input
                readOnly
                value={inviteUrl}
                aria-label="Invitation link"
                style={{ ...fieldStyle, width: '100%' }}
              />
            ) : null}
            {inviteNotice ? <p style={{ margin: 0, color: 'var(--status-good)' }}>{inviteNotice}</p> : null}
            {inviteError ? <p style={{ margin: 0, color: 'var(--status-urgent)' }}>{inviteError}</p> : null}
          </form>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Invitations</h2>
          {invitesLoading ? <p style={subtleText}>Loading invitations...</p> : null}
          {!invitesLoading && invitations.length === 0 ? (
            <p style={subtleText}>No invitations yet.</p>
          ) : null}
          <div style={{ display: 'grid', gap: 12 }}>
            {invitations.map((invitation) => {
              const isExpired = new Date(invitation.expires_at).getTime() < Date.now();
              const status = invitation.accepted_at
                ? 'Accepted'
                : invitation.revoked_at
                  ? 'Revoked'
                  : isExpired
                    ? 'Expired'
                    : 'Active';

              return (
                <div
                  key={invitation.id}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    gap: 12,
                    justifyContent: 'space-between',
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <strong>{roleLabel(invitation.role)}</strong>
                    <div style={subtleText}>
                      {invitation.invited_email || 'Anyone with the link'} · {status} · Expires {formatDate(invitation.expires_at)}
                    </div>
                  </div>
                  {!invitation.accepted_at && !invitation.revoked_at && !isExpired ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={revokingId === invitation.id}
                      onClick={() => revokeInvite(invitation.id)}
                    >
                      {revokingId === invitation.id ? 'Revoking...' : 'Revoke'}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>

        {transferProperty?.isOwner ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Transfer ownership</h2>
            <p style={subtleText}>
              When a home sells — or passes to an heir, or an inspector prepares it for a buyer — its entire living
              record can go with it: every serial number, paint code, repair, and manual, intact. A transfer hands this
              whole record, units included, to a new owner.
            </p>
            <p style={subtleText}>
              This is not an invitation. When the code is claimed, the claimant becomes the owner, every existing share
              and open invitation on this record is removed, and the handoff cannot be undone. You keep access only if
              you choose a kept role below.
            </p>

            {transferProperty.isUnit ? (
              <p style={{ ...subtleText, marginBottom: 0 }}>
                Units transfer with their building. Switch to the building itself to transfer the whole record.
              </p>
            ) : (
              <form onSubmit={createTransfer} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, alignItems: 'start' }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>Recipient email (optional)</span>
                    <input
                      type="email"
                      value={transferEmail}
                      onChange={(event) => setTransferEmail(event.target.value)}
                      placeholder="name@example.com"
                      style={fieldStyle}
                    />
                    <span style={{ ...subtleText, fontSize: 13 }}>
                      If set, only an account with this email can claim the code — and the invitation will appear on their dashboard when they sign in, so they do not need the link.
                    </span>
                  </label>

                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>Keep me on the record as</span>
                    <select
                      value={transferKeepRole}
                      onChange={(event) => setTransferKeepRole(event.target.value as '' | TransferKeepRole)}
                      style={fieldStyle}
                    >
                      <option value="">No access after handoff (recommended)</option>
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <span style={{ ...subtleText, fontSize: 13 }}>
                      A seller might keep read access briefly during the handoff. The new owner can remove it any time.
                    </span>
                  </label>

                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>Code expires in</span>
                    <select
                      value={transferExpiryDays}
                      onChange={(event) => setTransferExpiryDays(event.target.value)}
                      style={fieldStyle}
                    >
                      <option value="7">7 days</option>
                      <option value="14">14 days</option>
                      <option value="30">30 days</option>
                    </select>
                  </label>
                </div>

                <div>
                  <Button type="submit" disabled={creatingTransfer}>
                    {creatingTransfer ? 'Creating...' : 'Create transfer code'}
                  </Button>
                </div>

                {createdTransfer ? (
                  <div
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      padding: 14,
                      display: 'grid',
                      gap: 10
                    }}
                  >
                    <strong>Your transfer code — we can&rsquo;t show this again.</strong>
                    <input
                      readOnly
                      value={formatTransferCode(createdTransfer.code)}
                      aria-label="Transfer code"
                      style={{ ...fieldStyle, width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-mono)' }}
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={async () => {
                          await navigator.clipboard?.writeText(formatTransferCode(createdTransfer.code));
                          setTransferNotice('Transfer code copied.');
                        }}
                      >
                        Copy code
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={async () => {
                          await navigator.clipboard?.writeText(createdTransfer.claimUrl);
                          setTransferNotice('Claim link copied.');
                        }}
                      >
                        Copy claim link
                      </Button>
                    </div>
                    <p style={{ ...subtleText, margin: 0 }}>
                      Send the new owner the code and the claim page —{' '}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{createdTransfer.claimUrl}</span>.
                      They enter the code there. Expires {formatDate(createdTransfer.expiresAt)}.
                    </p>
                  </div>
                ) : null}

                {transferNotice ? <p style={{ margin: 0, color: 'var(--status-good)' }}>{transferNotice}</p> : null}
                {transferError ? <p style={{ margin: 0, color: 'var(--status-urgent)' }}>{transferError}</p> : null}
              </form>
            )}

            {!transferProperty.isUnit ? (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ marginBottom: 8 }}>Issued transfers</h3>
                {transfersLoading ? <p style={subtleText}>Loading transfers...</p> : null}
                {!transfersLoading && transfers.length === 0 ? (
                  <p style={{ ...subtleText, marginBottom: 0 }}>No transfers issued for this record.</p>
                ) : null}
                <div style={{ display: 'grid', gap: 12 }}>
                  {transfers.map((transfer) => {
                    const status = transferStatus(transfer, new Date().toISOString());
                    const statusLabel =
                      status === 'claimed' ? 'Claimed' : status === 'revoked' ? 'Revoked' : status === 'expired' ? 'Expired' : 'Active';

                    return (
                      <div
                        key={transfer.id}
                        style={{
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 8,
                          padding: 12,
                          display: 'flex',
                          gap: 12,
                          justifyContent: 'space-between',
                          flexWrap: 'wrap'
                        }}
                      >
                        <div>
                          <strong>{transfer.recipient_email || 'Anyone with the code'}</strong>
                          <div style={subtleText}>
                            {statusLabel} · Expires {formatDate(transfer.expires_at)}
                            {transfer.keep_issuer_role ? ` · You stay on as ${transfer.keep_issuer_role}` : ' · You keep no access after claim'}
                          </div>
                        </div>
                        {status === 'active' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={revokingTransferId === transfer.id}
                            onClick={() => revokeTransfer(transfer.id)}
                          >
                            {revokingTransferId === transfer.id ? 'Revoking...' : 'Revoke'}
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <label style={{ display: 'grid', gap: 6, maxWidth: 360 }}>
            <span style={{ fontWeight: 700 }}>Role to preview</span>
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as SharingRole)}
              style={fieldStyle}
            >
              {SHARING_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </label>
          <p style={{ ...subtleText, marginBottom: 0 }}>{roleCopy[selectedRole]}</p>
        </Card>

        {preview ? <SharingPreviewPanel preview={preview} /> : null}
      </div>
    </>
  );
}

function SharingPreviewPanel({ preview }: { preview: SharingPreview }) {
  const lookups = useMemo(() => buildLookups(preview), [preview]);
  const activeReceipts = preview.data.receipts.filter((receipt) => receipt.approval_status === 'approved').slice(0, 5);
  const documents = preview.data.documents.slice(0, 5);
  const visibleCounts = {
    rooms: preview.data.rooms.length,
    utilities: preview.data.utilities.length,
    assets: preview.data.assets.length,
    reminders: preview.data.reminders.length,
    repairs: preview.data.repairs.length,
    serviceRecords: preview.data.serviceRecords.length,
    issues: preview.data.issues.length,
    trendFlags: preview.data.trendFlags.length,
    documents: preview.data.documents.length,
    receipts: activeReceipts.length
  };

  return (
    <>
      <Card>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div>
            <h2 style={{ marginTop: 0 }}>{preview.label}</h2>
            <p style={subtleText}>{preview.summary}</p>
            {preview.warning ? (
              <div style={{ border: '1px solid rgba(224,189,131,0.45)', background: 'rgba(224,189,131,0.18)', borderRadius: 6, padding: 12 }}>
                <strong>{preview.warning}</strong>
              </div>
            ) : null}
          </div>

          <div>
            <h3 style={{ marginTop: 0 }}>Permission summary</h3>
            <PreviewRow label="Files" value={preview.fileBehavior} />
            <PreviewRow label="Receipts" value={preview.receiptBehavior} />
            <PreviewRow label="Financial details" value={preview.financialDetailsBehavior} />
            <PreviewRow label="Edits" value={preview.editBehavior} />
            <PreviewRow label="Deletes" value={preview.deleteBehavior} />
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>This role can see</h2>
          <PlainList items={preview.canSee} />
        </Card>
        <Card>
          <h2 style={{ marginTop: 0 }}>This role cannot see</h2>
          <PlainList items={preview.cannotSee} />
        </Card>
      </div>

      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>Visible sections</h2>
          <PlainList items={preview.visibleSections} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {preview.data.sections.map((section) => (
              <UtilityBadge key={section} label={sharingSectionLabel(section)} />
            ))}
          </div>
        </Card>
        <Card>
          <h2 style={{ marginTop: 0 }}>Hidden sections</h2>
          <PlainList items={preview.hiddenSections} />
        </Card>
      </div>

      <Card>
        <h2 style={{ marginTop: 0 }}>Sample scoped preview</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <UtilityBadge label={`${visibleCounts.rooms} rooms`} />
          <UtilityBadge label={`${visibleCounts.utilities} utilities`} />
          <UtilityBadge label={`${visibleCounts.assets} assets`} />
          <UtilityBadge label={`${visibleCounts.repairs} repairs`} />
          <UtilityBadge label={`${visibleCounts.issues} issues`} />
          <UtilityBadge label={`${visibleCounts.documents} file detail${visibleCounts.documents === 1 ? '' : 's'}`} />
          <UtilityBadge label={`${visibleCounts.receipts} approved receipts`} />
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <PreviewDataSection title="Rooms" hidden={preview.role === 'maintenance_guest'} emptyLabel="No rooms visible for this role.">
            <RecordList
              items={preview.data.rooms.slice(0, 6).map((room) => `${safeText(room.name) || 'Room'} · ${formatEnumLabel(room.room_type)} · ${safeText(room.floor_name) || 'Unassigned'}`)}
            />
          </PreviewDataSection>

          <PreviewDataSection title="Utilities" emptyLabel="No utilities visible for this role.">
            <RecordList
              items={preview.data.utilities.slice(0, 6).map((utility) => {
                const location = safeText(utility.location_notes) || linkedLabel(utility, lookups);
                return `${safeText(utility.name) || 'Utility'} · ${formatEnumLabel(utility.utility_type)} · ${location}`;
              })}
            />
          </PreviewDataSection>

          <PreviewDataSection title="Assets" emptyLabel="No assets visible for this role.">
            <RecordList
              items={preview.data.assets.slice(0, 6).map((asset) =>
                [
                  safeText(asset.name) || 'Asset',
                  formatEnumLabel(asset.asset_type),
                  linkedLabel(asset, lookups),
                  [safeText(asset.brand), safeText(asset.model)].filter(Boolean).join(' ')
                ].filter(Boolean).join(' · ')
              )}
            />
          </PreviewDataSection>

          <PreviewDataSection title="Repairs and service history" emptyLabel="No repairs or service history visible for this role.">
            <RecordList
              items={[
                ...preview.data.repairs.slice(0, 4).map((repair) =>
                  `${safeText(repair.title) || 'Repair'} · ${formatEnumLabel(repair.status)} · ${linkedLabel(repair, lookups)}`
                ),
                ...preview.data.serviceRecords.slice(0, 4).map((record) =>
                  `${safeText(record.service_title) || 'Service History'} · ${formatDate(record.service_date)} · ${linkedLabel(record, lookups)}`
                )
              ]}
            />
          </PreviewDataSection>

          <PreviewDataSection title="Issues and trends" emptyLabel="No issues or trends visible for this role.">
            <RecordList
              items={[
                ...preview.data.issues.slice(0, 4).map((issue) =>
                  `${safeText(issue.title) || 'Issue'} · ${formatEnumLabel(issue.severity)} · ${formatEnumLabel(issue.status)} · ${linkedLabel(issue, lookups)}`
                ),
                ...preview.data.trendFlags.slice(0, 4).map((flag) =>
                  `${safeText(flag.title) || 'Trend'} · ${formatEnumLabel(flag.status)} · ${formatEnumLabel(flag.severity)}`
                )
              ]}
            />
          </PreviewDataSection>

          <PreviewDataSection title="File details" hidden={documents.length === 0 && preview.role === 'maintenance_guest'} emptyLabel="No file details visible for this role.">
            <RecordList
              items={documents.map((document) =>
                [
                  safeText(document.title) || 'Document',
                  formatEnumLabel(document.document_type),
                  `Linked to ${linkedLabel(document, lookups)}`,
                  `File ${safeFileName(document.file_name) || 'hidden by privacy rule'}`
                ].join(' · ')
              )}
            />
          </PreviewDataSection>

          <PreviewDataSection title="Receipt details" hidden={preview.role === 'maintenance_guest' || preview.role === 'buyer_preview'} emptyLabel="No receipt details visible for this role.">
            <RecordList
              items={activeReceipts.map((receipt) => {
                const amount = preview.receiptAmountsVisible ? formatAmount(receipt.total_amount, receipt.currency) : 'Hidden';
                return `${safeText(receipt.vendor_name) || safeText(receipt.description) || 'Receipt'} · ${formatDate(receipt.purchase_date || receipt.created_at)} · ${formatEnumLabel(receipt.category)} · Amount: ${amount}`;
              })}
            />
          </PreviewDataSection>
        </div>
      </Card>
    </>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <strong>{label}:</strong> <span style={subtleText}>{value}</span>
    </div>
  );
}

function PlainList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function PreviewDataSection({
  title,
  hidden,
  emptyLabel,
  children
}: {
  title: string;
  hidden?: boolean;
  emptyLabel: string;
  children: ReactNode;
}) {
  if (hidden) {
    return (
      <section style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <p style={subtleText}>{emptyLabel}</p>
      </section>
    );
  }

  return (
    <section style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      {children}
    </section>
  );
}

function RecordList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p style={subtleText}>No visible records in this sample.</p>;
  }

  return (
    <ul style={{ marginBottom: 0, paddingLeft: 20, lineHeight: 1.7 }}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
