import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  formatEnumLabel,
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  ISSUE_TYPES
} from '@home-folder/shared';
import { Button, Card, PageHeader, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import { RelatedDocuments } from '../../components/RelatedDocuments';
import { RoomLocationSelect, roomSelectionValue } from '../../components/RoomLocationSelect';
import { getAssetsForProperty, getDemoAssets, type AssetRow } from '../../lib/assets';
import { getDemoRooms } from '../../lib/demoStorage';
import {
  getDocumentDataContext,
  getDocumentsForLink,
  type DocumentDataContext,
  type DocumentRow
} from '../../lib/documents';
import {
  deleteIssueForContext,
  getIssueByIdForContext,
  getIssueDataContext,
  updateIssueForContext,
  updateIssueStatusForContext,
  type IssueDataContext,
  type IssueDataMode,
  type IssueRow,
  type IssueSeverity,
  type IssueStatus,
  type IssueType
} from '../../lib/issues';
import {
  isLocationPresetValue,
  resolveLocationRoomId,
  rollbackCreatedLocation
} from '../../lib/locationPresets';
import { formatRoomLocation } from '../../lib/roomLabels';
import { getReminderDataContext, getRemindersForContext, type ReminderRow } from '../../lib/reminders';
import { getDemoRepairs, getRepairsForProperty, type RepairRow } from '../../lib/repairs';
import { getRoomsForProperty } from '../../lib/rooms';
import { getTrendFlagDataContext, getTrendFlagsForIssue, type TrendFlagRow } from '../../lib/trendFlags';
import { getDemoUtilities, getUtilitiesForProperty, type UtilityRow } from '../../lib/utilities';

type LinkOption = {
  id: string;
  name: string;
};

type RoomOption = LinkOption & {
  room_type?: string | null;
  floor_name?: string | null;
};

const fieldStyle = {
  padding: 10,
  borderRadius: 4,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)'
};

const labelStyle = { display: 'grid', gap: 6 } as const;

const fieldRowStyle = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
} as const;

function nameFromId(list: LinkOption[], id?: string | null) {
  if (!id) return null;
  return list.find((item) => item.id === id)?.name || 'Unknown';
}

function roomNameFromId(list: RoomOption[], id?: string | null) {
  if (!id) return null;
  const room = list.find((item) => item.id === id);
  return room ? formatRoomLocation(room) : 'Unknown';
}

function reminderRelatesToIssue(issue: IssueRow, reminder: ReminderRow) {
  return (
    (!!issue.room_id && (reminder.room_id === issue.room_id || (reminder.linked_type === 'room' && reminder.linked_id === issue.room_id))) ||
    (!!issue.asset_id && (reminder.asset_id === issue.asset_id || (reminder.linked_type === 'asset' && reminder.linked_id === issue.asset_id))) ||
    (!!issue.utility_id && (reminder.utility_id === issue.utility_id || (reminder.linked_type === 'utility' && reminder.linked_id === issue.utility_id)))
  );
}

export default function IssueDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const issueId = typeof id === 'string' ? id : '';

  const [context, setContext] = useState<IssueDataContext | null>(null);
  const [dataMode, setDataMode] = useState<IssueDataMode>('demo');
  const [issue, setIssue] = useState<IssueRow | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [assets, setAssets] = useState<LinkOption[]>([]);
  const [utilities, setUtilities] = useState<LinkOption[]>([]);
  const [repairs, setRepairs] = useState<LinkOption[]>([]);
  const [documentContext, setDocumentContext] = useState<DocumentDataContext | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [trendFlags, setTrendFlags] = useState<TrendFlagRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('general');
  const [status, setStatus] = useState<IssueStatus>('open');
  const [severity, setSeverity] = useState<IssueSeverity>('medium');
  const [firstSeenDate, setFirstSeenDate] = useState('');
  const [lastSeenDate, setLastSeenDate] = useState('');
  const [resolvedDate, setResolvedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [roomChoice, setRoomChoice] = useState('');
  const [roomCustomName, setRoomCustomName] = useState('');
  const [assetId, setAssetId] = useState('');
  const [utilityId, setUtilityId] = useState('');
  const [repairId, setRepairId] = useState('');

  // One place that fills the edit form from a saved issue, so loading the page,
  // saving, and discarding all land on the same values.
  const applyIssueToForm = useCallback((source: IssueRow) => {
    setTitle(source.title);
    setDescription(source.description || '');
    setIssueType(source.issue_type);
    setStatus(source.status);
    setSeverity(source.severity);
    setFirstSeenDate(source.first_seen_date || '');
    setLastSeenDate(source.last_seen_date || '');
    setResolvedDate(source.resolved_date || '');
    setNotes(source.notes || '');
    setRoomChoice(source.room_id || '');
    setRoomCustomName('');
    setAssetId(source.asset_id || '');
    setUtilityId(source.utility_id || '');
    setRepairId(source.repair_id || '');
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!issueId) return;

      setLoading(true);
      setError('');

      try {
        const [nextContext, documentContextForLoad, reminderContext, trendFlagContext] = await Promise.all([
          getIssueDataContext(),
          getDocumentDataContext(),
          getReminderDataContext(),
          getTrendFlagDataContext()
        ]);

        const nextIssue = await getIssueByIdForContext(nextContext, issueId);
        const [roomRows, assetRows, utilityRows, repairRows] =
          nextContext.mode === 'supabase' && nextContext.property
            ? await Promise.all([
                getRoomsForProperty(nextContext.property.id),
                getAssetsForProperty(nextContext.property.id),
                getUtilitiesForProperty(nextContext.property.id),
                getRepairsForProperty(nextContext.property.id)
              ])
            : [getDemoRooms(), getDemoAssets(), getDemoUtilities(), getDemoRepairs()];

        const [issueDocuments, issueTrendFlags, allReminders] = await Promise.all([
          getDocumentsForLink(documentContextForLoad, { field: 'issue_id', id: issueId }),
          getTrendFlagsForIssue(trendFlagContext, issueId),
          getRemindersForContext(reminderContext)
        ]);

        if (!isMounted) return;

        setContext(nextContext);
        setDataMode(nextContext.mode);
        setIssue(nextIssue);
        setRooms(
          roomRows.map((room) => ({
            id: room.id,
            name: room.name,
            room_type: room.room_type,
            floor_name: room.floor_name
          }))
        );
        setAssets(assetRows.map((asset: AssetRow) => ({ id: asset.id, name: asset.name })));
        setUtilities(utilityRows.map((utility: UtilityRow) => ({ id: utility.id, name: utility.name })));
        setRepairs(repairRows.map((repair: RepairRow) => ({ id: repair.id, name: repair.title })));
        setDocumentContext(documentContextForLoad);
        setDocuments(issueDocuments);
        setTrendFlags(issueTrendFlags);
        setReminders(nextIssue ? allReminders.filter((reminder) => reminderRelatesToIssue(nextIssue, reminder)) : []);

        if (nextIssue) {
          applyIssueToForm(nextIssue);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load issue.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load().catch((err) => {
      if (isMounted) {
        setError(err instanceof Error ? err.message : 'Failed to load data.');
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [issueId, applyIssueToForm]);

  const changeStatus = async (nextStatus: IssueStatus) => {
    if (!context || !issue) return;

    setActing(true);
    setError('');

    try {
      const updatedIssue = await updateIssueStatusForContext(context, issue.id, nextStatus);
      if (updatedIssue) {
        setIssue(updatedIssue);
        // The edit form below holds the same fields; keep it in step so a later
        // save doesn't write the status back to what it was.
        applyIssueToForm(updatedIssue);
      }
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update issue status.');
    } finally {
      setActing(false);
    }
  };

  const saveIssue = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!context || !issue) return;

    setNotice('');

    if (!title.trim()) {
      setFormError('An issue needs a title.');
      return;
    }

    const roomValue = roomSelectionValue(roomChoice, roomCustomName);

    if (roomValue === null) {
      setFormError('Give the new room a name, or pick one from the list.');
      return;
    }

    setSaving(true);
    setFormError('');

    const resolutionContext =
      context.mode === 'supabase' && context.property
        ? ({ mode: 'supabase', propertyId: context.property.id } as const)
        : ({ mode: 'demo' } as const);

    let createdRoomId: string | null = null;

    try {
      const wasPreset = isLocationPresetValue(roomValue);
      const resolved = await resolveLocationRoomId(roomValue, resolutionContext);
      createdRoomId = resolved.createdRoomId;

      const updatedIssue = await updateIssueForContext(context, issue.id, {
        title,
        description,
        issue_type: issueType,
        status,
        severity,
        first_seen_date: firstSeenDate || null,
        last_seen_date: lastSeenDate || null,
        resolved_date: resolvedDate || null,
        notes,
        room_id: resolved.roomId,
        asset_id: assetId || null,
        utility_id: utilityId || null,
        repair_id: repairId || null
      });

      if (updatedIssue) {
        setIssue(updatedIssue);
        applyIssueToForm(updatedIssue);
      }

      if (wasPreset) {
        const refreshedRooms =
          context.mode === 'supabase' && context.property
            ? await getRoomsForProperty(context.property.id)
            : getDemoRooms();
        setRooms(
          refreshedRooms.map((room) => ({
            id: room.id,
            name: room.name,
            room_type: room.room_type,
            floor_name: room.floor_name
          }))
        );
      }

      setNotice('Issue updated.');
    } catch (saveError) {
      // A preset location creates its room before the issue is written. If the
      // write fails, take the room back out rather than leaving an empty space
      // on the home map that nobody asked for.
      await rollbackCreatedLocation(createdRoomId, resolutionContext);
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to update issue.');
    } finally {
      setSaving(false);
    }
  };

  const deleteIssue = async () => {
    if (!context || !issue) return;

    if (!window.confirm('Delete this issue?')) {
      return;
    }

    setActing(true);
    setError('');

    try {
      await deleteIssueForContext(context, issue.id);
      router.push('/issues');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete issue.');
      setActing(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Issue" />
        <Card>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading issue...</p>
        </Card>
      </>
    );
  }

  if (!issue) {
    return (
      <>
        <PageHeader title={error ? 'Issue error' : 'Issue not found'} />
        <Card>
          <p style={{ color: error ? 'var(--status-urgent)' : 'var(--text-muted)', fontWeight: error ? 700 : 400 }}>
            {error || 'This issue may have been removed, or it may not belong to the current property.'}
          </p>
          <ActionLink href="/issues" variant="secondary">Back to issues</ActionLink>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={issue.title} description={formatEnumLabel(issue.issue_type)} />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? 'var(--status-good)' : 'var(--text-muted)' }}>
            {dataMode === 'supabase'
              ? 'Saved to your account.'
              : 'Demo data is stored only in this browser.'}
          </p>
          {error ? (
            <p style={{ color: 'var(--status-urgent)', fontWeight: 700 }} role="alert">{error}</p>
          ) : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Issue snapshot</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <UtilityBadge label={formatEnumLabel(issue.status)} />
            <UtilityBadge label={formatEnumLabel(issue.severity)} />
            {issue.room_id && <UtilityBadge label={`Room: ${roomNameFromId(rooms, issue.room_id) || 'Unknown'}`} />}
            {issue.asset_id && <UtilityBadge label={`Asset: ${nameFromId(assets, issue.asset_id) || 'Unknown'}`} />}
            {issue.utility_id && <UtilityBadge label={`Utility: ${nameFromId(utilities, issue.utility_id) || 'Unknown'}`} />}
            {issue.repair_id && <UtilityBadge label={`Repair: ${nameFromId(repairs, issue.repair_id) || 'Unknown'}`} />}
            <UtilityBadge label={`${documents.length} document${documents.length === 1 ? '' : 's'}`} />
          </div>
          <div style={{ color: 'var(--text-muted)', display: 'grid', gap: 6 }}>
            <div><strong>First seen:</strong> {issue.first_seen_date || 'Not set'}</div>
            {issue.last_seen_date && <div><strong>Last seen:</strong> {issue.last_seen_date}</div>}
            {issue.resolved_date && <div><strong>Resolved:</strong> {issue.resolved_date}</div>}
            {issue.description && <div><strong>Description:</strong> {issue.description}</div>}
            {issue.notes && <div><strong>Notes:</strong> {issue.notes}</div>}
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Status</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={issue.status} onChange={(event) => changeStatus(event.target.value as IssueStatus)} disabled={acting} style={fieldStyle}>
              {ISSUE_STATUSES.map((status) => (
                <option key={status} value={status}>{formatEnumLabel(status)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={deleteIssue}
              disabled={acting}
              style={{
                padding: '10px 14px',
                borderRadius: 6,
                border: '1px solid rgba(163,78,51,0.30)',
                background: 'rgba(163,78,51,0.08)',
                color: 'var(--status-urgent)',
                cursor: acting ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                opacity: acting ? 0.7 : 1
              }}
            >
              Delete issue
            </button>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Edit issue</h2>
          <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
            Everything about this issue stays open to correction — including which room,
            appliance, utility, or repair it belongs to.
          </p>
          <form onSubmit={saveIssue} style={{ display: 'grid', gap: 12 }}>
            <label style={labelStyle}>
              <span style={{ fontWeight: 600 }}>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} style={fieldStyle} />
            </label>

            <div style={fieldRowStyle}>
              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Issue type</span>
                <select
                  value={issueType}
                  onChange={(event) => setIssueType(event.target.value as IssueType)}
                  style={fieldStyle}
                >
                  {ISSUE_TYPES.map((type) => (
                    <option key={type} value={type}>{formatEnumLabel(type)}</option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Status</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as IssueStatus)}
                  style={fieldStyle}
                >
                  {ISSUE_STATUSES.map((value) => (
                    <option key={value} value={value}>{formatEnumLabel(value)}</option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Severity</span>
                <select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value as IssueSeverity)}
                  style={fieldStyle}
                >
                  {ISSUE_SEVERITIES.map((value) => (
                    <option key={value} value={value}>{formatEnumLabel(value)}</option>
                  ))}
                </select>
              </label>
            </div>

            <RoomLocationSelect
              rooms={rooms}
              value={roomChoice}
              onChange={setRoomChoice}
              customName={roomCustomName}
              onCustomNameChange={setRoomCustomName}
              label="Room or location"
              emptyLabel="Not linked to a room"
              disabled={saving}
            />

            <div style={fieldRowStyle}>
              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Appliance or asset</span>
                <select value={assetId} onChange={(event) => setAssetId(event.target.value)} style={fieldStyle}>
                  <option value="">Not linked</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.name}</option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Utility</span>
                <select value={utilityId} onChange={(event) => setUtilityId(event.target.value)} style={fieldStyle}>
                  <option value="">Not linked</option>
                  {utilities.map((utility) => (
                    <option key={utility.id} value={utility.id}>{utility.name}</option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Repair</span>
                <select value={repairId} onChange={(event) => setRepairId(event.target.value)} style={fieldStyle}>
                  <option value="">Not linked</option>
                  {repairs.map((repair) => (
                    <option key={repair.id} value={repair.id}>{repair.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <label style={labelStyle}>
              <span style={{ fontWeight: 600 }}>Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                style={{ ...fieldStyle, minHeight: 80 }}
              />
            </label>

            <div style={fieldRowStyle}>
              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>First seen</span>
                <input
                  type="date"
                  value={firstSeenDate}
                  onChange={(event) => setFirstSeenDate(event.target.value)}
                  style={fieldStyle}
                />
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Last seen</span>
                <input
                  type="date"
                  value={lastSeenDate}
                  onChange={(event) => setLastSeenDate(event.target.value)}
                  style={fieldStyle}
                />
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Resolved</span>
                <input
                  type="date"
                  value={resolvedDate}
                  onChange={(event) => setResolvedDate(event.target.value)}
                  style={fieldStyle}
                />
              </label>
            </div>

            <label style={labelStyle}>
              <span style={{ fontWeight: 600 }}>Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                style={{ ...fieldStyle, minHeight: 70 }}
              />
            </label>

            {formError ? (
              <p style={{ margin: 0, color: 'var(--status-urgent)', fontWeight: 700 }} role="alert">
                {formError}
              </p>
            ) : null}
            {notice ? (
              <p style={{ margin: 0, color: 'var(--status-good)', fontWeight: 600 }} role="status">
                {notice}
              </p>
            ) : null}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  applyIssueToForm(issue);
                  setFormError('');
                  setNotice('');
                }}
              >
                Discard changes
              </Button>
            </div>
          </form>
        </Card>

        {issue.repair_id ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Linked repair</h2>
            <Link href={`/repairs/${issue.repair_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 700 }}>{nameFromId(repairs, issue.repair_id) || 'Repair'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Open repair detail</div>
              </div>
            </Link>
          </Card>
        ) : null}

        <RelatedList title="Trends" empty="No trends linked to this issue.">
          {trendFlags.map((flag) => (
            <RelatedItem key={flag.id} title={flag.title} detail={`${formatEnumLabel(flag.status)} • ${formatEnumLabel(flag.severity)}`} />
          ))}
        </RelatedList>

        <RelatedDocuments
          documents={documents}
          context={documentContext}
          uploadHref={`/documents?issueId=${issue.id}`}
          empty="No documents linked to this issue."
        />

        <RelatedList title="Related reminders" empty="No reminders are related to this issue's linked room, asset, or utility.">
          {reminders.map((reminder) => (
            <RelatedItem key={reminder.id} title={reminder.title} detail={`${reminder.due_date || 'No due date'} • ${formatEnumLabel(reminder.status)}`} />
          ))}
        </RelatedList>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ActionLink href="/issues" variant="secondary">Back to issues</ActionLink>
          <ActionLink href="/dashboard" variant="secondary">Back to dashboard</ActionLink>
        </div>
      </div>
    </>
  );
}

function RelatedList({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {hasItems ? <div style={{ display: 'grid', gap: 10 }}>{children}</div> : <p style={{ color: 'var(--text-muted)', margin: 0 }}>{empty}</p>}
    </Card>
  );
}

function RelatedItem({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{detail}</div>
    </div>
  );
}
