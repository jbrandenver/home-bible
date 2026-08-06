import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  formatEnumLabel,
  REPAIR_PRIORITIES,
  REPAIR_STATUSES,
  REPAIR_TYPES
} from '@home-folder/shared';
import { Button, Card, ConfirmDialog, PageHeader, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import { ViewOnlyNotice } from '../../components/ViewOnlyNotice';
import { usePropertyAccess } from '../../lib/access';
import { RelatedDocuments } from '../../components/RelatedDocuments';
import { RelatedReceipts } from '../../components/RelatedReceipts';
import { RoomLocationSelect, roomSelectionValue } from '../../components/RoomLocationSelect';
import { getAssetsForProperty, getDemoAssets, type AssetRow } from '../../lib/assets';
import { getDemoRooms } from '../../lib/demoStorage';
import {
  isLocationPresetValue,
  resolveLocationRoomId,
  rollbackCreatedLocation
} from '../../lib/locationPresets';
import { formatRoomLocation } from '../../lib/roomLabels';
import {
  getDocumentDataContext,
  getDocumentsForLink,
  type DocumentDataContext,
  type DocumentRow
} from '../../lib/documents';
import { getIssueDataContext, getIssuesForRepair, type IssueRow } from '../../lib/issues';
import { getReminderDataContext, getRemindersForContext, type ReminderRow } from '../../lib/reminders';
import { getReceiptDataContext, getReceiptsForLink, type ReceiptDataContext, type ReceiptRow } from '../../lib/receipts';
import {
  deleteRepairForContext,
  getRepairByIdForContext,
  getRepairDataContext,
  updateRepairForContext,
  updateRepairStatusForContext,
  type RepairDataContext,
  type RepairDataMode,
  type RepairPriority,
  type RepairRow,
  type RepairStatus,
  type RepairType
} from '../../lib/repairs';
import { getRoomsForProperty } from '../../lib/rooms';
import { getServiceRecordDataContext, getServiceRecordsForContext, type ServiceRecordRow } from '../../lib/serviceRecords';
import { getTrendFlagDataContext, getTrendFlagsForContext, type TrendFlagRow } from '../../lib/trendFlags';
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

function moneyValue(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sharesRepairLink(
  repair: RepairRow,
  item: { room_id?: string | null; asset_id?: string | null; utility_id?: string | null }
) {
  return (
    (!!repair.asset_id && item.asset_id === repair.asset_id) ||
    (!!repair.utility_id && item.utility_id === repair.utility_id) ||
    (!!repair.room_id && item.room_id === repair.room_id)
  );
}

function reminderSharesRepairLink(repair: RepairRow, reminder: ReminderRow) {
  return (
    sharesRepairLink(repair, reminder) ||
    (!!repair.room_id && reminder.linked_type === 'room' && reminder.linked_id === repair.room_id) ||
    (!!repair.asset_id && reminder.linked_type === 'asset' && reminder.linked_id === repair.asset_id) ||
    (!!repair.utility_id && reminder.linked_type === 'utility' && reminder.linked_id === repair.utility_id)
  );
}

export default function RepairDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const repairId = typeof id === 'string' ? id : '';

  const access = usePropertyAccess();
  const [context, setContext] = useState<RepairDataContext | null>(null);
  const [dataMode, setDataMode] = useState<RepairDataMode>('demo');
  const [repair, setRepair] = useState<RepairRow | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [assets, setAssets] = useState<LinkOption[]>([]);
  const [utilities, setUtilities] = useState<LinkOption[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
  const [documentContext, setDocumentContext] = useState<DocumentDataContext | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [receiptContext, setReceiptContext] = useState<ReceiptDataContext | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [trendFlags, setTrendFlags] = useState<TrendFlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  // Two-step deletion: "Delete repair" only opens this dialog. window.confirm
  // proved unreliable (a suppressed dialog returns false and the click dies
  // silently), so this uses the in-page ConfirmDialog.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [repairType, setRepairType] = useState<RepairType>('general');
  const [status, setStatus] = useState<RepairStatus>('open');
  const [priority, setPriority] = useState<RepairPriority>('normal');
  const [reportedDate, setReportedDate] = useState('');
  const [completedDate, setCompletedDate] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledWindow, setScheduledWindow] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [contractorPhone, setContractorPhone] = useState('');
  const [contractorEmail, setContractorEmail] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [notes, setNotes] = useState('');
  const [roomChoice, setRoomChoice] = useState('');
  const [roomCustomName, setRoomCustomName] = useState('');
  const [assetId, setAssetId] = useState('');
  const [utilityId, setUtilityId] = useState('');

  // One place that fills the edit form from a saved repair, so loading the
  // page, saving, and discarding all land on the same values.
  const applyRepairToForm = useCallback((source: RepairRow) => {
    setTitle(source.title);
    setDescription(source.description || '');
    setRepairType(source.repair_type);
    setStatus(source.status);
    setPriority(source.priority);
    setReportedDate(source.reported_date || '');
    setCompletedDate(source.completed_date || '');
    setScheduledDate(source.scheduled_date || '');
    setScheduledWindow(source.scheduled_window || '');
    setContractorName(source.contractor_name || '');
    setContractorPhone(source.contractor_phone || '');
    setContractorEmail(source.contractor_email || '');
    setEstimatedCost(source.estimated_cost === null ? '' : String(source.estimated_cost));
    setActualCost(source.actual_cost === null ? '' : String(source.actual_cost));
    setNotes(source.notes || '');
    setRoomChoice(source.room_id || '');
    setRoomCustomName('');
    setAssetId(source.asset_id || '');
    setUtilityId(source.utility_id || '');
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!repairId) return;

      setLoading(true);
      setError('');

      try {
        const [nextContext, serviceContext, documentContextForLoad, receiptContextForLoad, reminderContext, issueContext, trendFlagContext] = await Promise.all([
          getRepairDataContext(),
          getServiceRecordDataContext(),
          getDocumentDataContext(),
          getReceiptDataContext(),
          getReminderDataContext(),
          getIssueDataContext(),
          getTrendFlagDataContext()
        ]);

        const nextRepair = await getRepairByIdForContext(nextContext, repairId);
        const [roomRows, assetRows, utilityRows] =
          nextContext.mode === 'supabase' && nextContext.property
            ? await Promise.all([
                getRoomsForProperty(nextContext.property.id),
                getAssetsForProperty(nextContext.property.id),
                getUtilitiesForProperty(nextContext.property.id)
              ])
            : [getDemoRooms(), getDemoAssets(), getDemoUtilities()];

        const [allServiceRecords, repairDocuments, repairReceipts, allReminders, repairIssues, allTrendFlags] = await Promise.all([
          getServiceRecordsForContext(serviceContext),
          getDocumentsForLink(documentContextForLoad, { field: 'repair_id', id: repairId }),
          getReceiptsForLink(receiptContextForLoad, { field: 'repair_id', id: repairId }),
          getRemindersForContext(reminderContext),
          getIssuesForRepair(issueContext, repairId),
          getTrendFlagsForContext(trendFlagContext)
        ]);

        if (!isMounted) return;

        setContext(nextContext);
        setDataMode(nextContext.mode);
        setRepair(nextRepair);
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
        setDocumentContext(documentContextForLoad);
        setDocuments(repairDocuments);
        setReceiptContext(receiptContextForLoad);
        setReceipts(repairReceipts);
        setIssues(repairIssues);

        if (nextRepair) {
          applyRepairToForm(nextRepair);

          const issueIds = new Set(repairIssues.map((issue) => issue.id));
          setServiceRecords(allServiceRecords.filter((record) => sharesRepairLink(nextRepair, record)));
          setReminders(allReminders.filter((reminder) => reminderSharesRepairLink(nextRepair, reminder)));
          setTrendFlags(
            allTrendFlags.filter(
              (flag) =>
                sharesRepairLink(nextRepair, flag) ||
                (!!flag.issue_id && issueIds.has(flag.issue_id))
            )
          );
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load repair.');
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
  }, [repairId, applyRepairToForm]);

  const statusOptions = useMemo(() => REPAIR_STATUSES, []);

  const changeStatus = async (nextStatus: RepairStatus) => {
    if (!context || !repair) return;

    setActing(true);
    setError('');

    try {
      const updatedRepair = await updateRepairStatusForContext(context, repair.id, nextStatus);
      if (updatedRepair) {
        setRepair(updatedRepair);
        // The edit form below holds the same fields; keep it in step so a later
        // save doesn't write the status back to what it was.
        applyRepairToForm(updatedRepair);
      }
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update repair status.');
    } finally {
      setActing(false);
    }
  };

  const saveRepair = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!context || !repair) return;

    setNotice('');

    if (!title.trim()) {
      setFormError('A repair needs a title.');
      return;
    }

    const parsedEstimatedCost = moneyValue(estimatedCost);
    const parsedActualCost = moneyValue(actualCost);

    if ((estimatedCost && parsedEstimatedCost === null) || (actualCost && parsedActualCost === null)) {
      setFormError('Costs need to be numbers, or left empty.');
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

      const updatedRepair = await updateRepairForContext(context, repair.id, {
        title,
        description,
        repair_type: repairType,
        status,
        priority,
        reported_date: reportedDate || null,
        completed_date: completedDate || null,
        scheduled_date: scheduledDate || null,
        scheduled_window: scheduledWindow,
        contractor_name: contractorName,
        contractor_phone: contractorPhone,
        contractor_email: contractorEmail,
        estimated_cost: parsedEstimatedCost,
        actual_cost: parsedActualCost,
        notes,
        room_id: resolved.roomId,
        asset_id: assetId || null,
        utility_id: utilityId || null
      });

      if (updatedRepair) {
        setRepair(updatedRepair);
        applyRepairToForm(updatedRepair);
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

      setNotice('Repair updated.');
    } catch (saveError) {
      // A preset location creates its room before the repair is written. If the
      // write fails, take the room back out rather than leaving an empty space
      // on the home map that nobody asked for.
      await rollbackCreatedLocation(createdRoomId, resolutionContext);
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to update repair.');
    } finally {
      setSaving(false);
    }
  };

  const requestDeleteRepair = () => {
    if (!context || !repair) return;
    setError('');
    setConfirmingDelete(true);
  };

  const deleteRepair = async () => {
    if (!context || !repair || acting) return;

    setActing(true);
    setError('');

    try {
      await deleteRepairForContext(context, repair.id);
      router.push('/repairs');
    } catch (deleteError) {
      // Close the dialog so the error is readable on the page it points at.
      setConfirmingDelete(false);
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete repair.');
      setActing(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Repair" />
        <Card>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading repair...</p>
        </Card>
      </>
    );
  }

  if (!repair) {
    return (
      <>
        <PageHeader title={error ? 'Repair error' : 'Repair not found'} />
        <Card>
          <p style={{ color: error ? 'var(--status-urgent)' : 'var(--text-muted)', fontWeight: error ? 700 : 400 }}>
            {error || 'This repair may have been removed, or it may not belong to the current property.'}
          </p>
          <ActionLink href="/repairs" variant="secondary">Back to repairs</ActionLink>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={repair.title} description={formatEnumLabel(repair.repair_type)} />

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
          <h2 style={{ marginTop: 0 }}>Repair snapshot</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <UtilityBadge label={formatEnumLabel(repair.status)} />
            <UtilityBadge label={formatEnumLabel(repair.priority)} />
            {repair.room_id && <UtilityBadge label={`Room: ${roomNameFromId(rooms, repair.room_id) || 'Unknown'}`} />}
            {repair.asset_id && <UtilityBadge label={`Asset: ${nameFromId(assets, repair.asset_id) || 'Unknown'}`} />}
            {repair.utility_id && <UtilityBadge label={`Utility: ${nameFromId(utilities, repair.utility_id) || 'Unknown'}`} />}
            <UtilityBadge label={`${documents.length} document${documents.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${receipts.length} receipt${receipts.length === 1 ? '' : 's'}`} />
          </div>
          <div style={{ color: 'var(--text-muted)', display: 'grid', gap: 6 }}>
            <div><strong>Reported:</strong> {repair.reported_date || 'Not set'}</div>
            {(repair.scheduled_date || repair.scheduled_window) && (
              <div>
                <strong>Scheduled visit:</strong>{' '}
                {[repair.scheduled_date, repair.scheduled_window].filter(Boolean).join(' · ')}
              </div>
            )}
            {repair.completed_date && <div><strong>Completed:</strong> {repair.completed_date}</div>}
            {repair.contractor_name && <div><strong>Contractor:</strong> {repair.contractor_name}</div>}
            {repair.estimated_cost !== null && <div><strong>Estimated:</strong> ${repair.estimated_cost}</div>}
            {repair.actual_cost !== null && <div><strong>Actual:</strong> ${repair.actual_cost}</div>}
            {repair.description && <div><strong>Description:</strong> {repair.description}</div>}
            {repair.notes && <div><strong>Notes:</strong> {repair.notes}</div>}
          </div>
        </Card>

        <Card tone="dark">
          <h2 style={{ marginTop: 0 }}>Share with a repair pro</h2>
          <p style={{ color: 'rgba(255,248,234,0.78)' }}>
            Build a clear, printable sheet anyone at home can hand or text to a technician — with the
            issue, the relevant shut-offs, and service history. Sensitive codes are left out automatically.
          </p>
          <ActionLink href={`/repairs/${repair.id}/service-call`}>Create service call sheet</ActionLink>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Status</h2>
          {!access.loading && !access.canWrite ? (
            <ViewOnlyNotice role={access.role} action="change this repair" inline />
          ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={repair.status} onChange={(event) => changeStatus(event.target.value as RepairStatus)} disabled={acting} style={fieldStyle}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{formatEnumLabel(status)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={requestDeleteRepair}
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
              Delete repair
            </button>
          </div>
          )}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Edit repair</h2>
          <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
            Everything about this repair stays open to correction — including which room,
            appliance, or utility it belongs to, and when the visit is booked.
          </p>
          {!access.loading && !access.canWrite ? (
            <ViewOnlyNotice role={access.role} action="edit this repair" inline />
          ) : (
          <form onSubmit={saveRepair} style={{ display: 'grid', gap: 12 }}>
            <label style={labelStyle}>
              <span style={{ fontWeight: 600 }}>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} style={fieldStyle} />
            </label>

            <div style={fieldRowStyle}>
              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Repair type</span>
                <select
                  value={repairType}
                  onChange={(event) => setRepairType(event.target.value as RepairType)}
                  style={fieldStyle}
                >
                  {REPAIR_TYPES.map((type) => (
                    <option key={type} value={type}>{formatEnumLabel(type)}</option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Status</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as RepairStatus)}
                  style={fieldStyle}
                >
                  {REPAIR_STATUSES.map((value) => (
                    <option key={value} value={value}>{formatEnumLabel(value)}</option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Priority</span>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as RepairPriority)}
                  style={fieldStyle}
                >
                  {REPAIR_PRIORITIES.map((value) => (
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
                <span style={{ fontWeight: 600 }}>Reported date</span>
                <input
                  type="date"
                  value={reportedDate}
                  onChange={(event) => setReportedDate(event.target.value)}
                  style={fieldStyle}
                />
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Completed date</span>
                <input
                  type="date"
                  value={completedDate}
                  onChange={(event) => setCompletedDate(event.target.value)}
                  style={fieldStyle}
                />
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Estimated cost</span>
                <input
                  type="number"
                  step="0.01"
                  value={estimatedCost}
                  onChange={(event) => setEstimatedCost(event.target.value)}
                  style={fieldStyle}
                />
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Actual cost</span>
                <input
                  type="number"
                  step="0.01"
                  value={actualCost}
                  onChange={(event) => setActualCost(event.target.value)}
                  style={fieldStyle}
                />
              </label>
            </div>

            <div style={fieldRowStyle}>
              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Visit scheduled for</span>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                  style={fieldStyle}
                />
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Arrival window</span>
                <input
                  value={scheduledWindow}
                  onChange={(event) => setScheduledWindow(event.target.value)}
                  placeholder="8am – 12pm"
                  style={fieldStyle}
                />
              </label>
            </div>

            <div style={fieldRowStyle}>
              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Contractor name</span>
                <input
                  value={contractorName}
                  onChange={(event) => setContractorName(event.target.value)}
                  style={fieldStyle}
                />
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Contractor phone</span>
                <input
                  value={contractorPhone}
                  onChange={(event) => setContractorPhone(event.target.value)}
                  style={fieldStyle}
                />
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600 }}>Contractor email</span>
                <input
                  type="email"
                  value={contractorEmail}
                  onChange={(event) => setContractorEmail(event.target.value)}
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
                  applyRepairToForm(repair);
                  setFormError('');
                  setNotice('');
                }}
              >
                Discard changes
              </Button>
            </div>
          </form>
          )}
        </Card>

        <RelatedList title="Service History" empty="No related service history found.">
          {serviceRecords.map((record) => (
            <RelatedItem key={record.id} title={record.service_title} detail={`${record.service_date} • ${formatEnumLabel(record.service_type)}`} />
          ))}
        </RelatedList>

        <RelatedDocuments
          documents={documents}
          context={documentContext}
          uploadHref={`/documents?repairId=${repair.id}`}
          empty="No documents linked to this repair."
        />

        <RelatedReceipts
          receipts={receipts}
          context={receiptContext}
          uploadHref={`/receipts?repairId=${repair.id}`}
          empty="No receipts linked to this repair."
        />

        <RelatedList title="Reminders" empty="No related reminders found.">
          {reminders.map((reminder) => (
            <RelatedItem key={reminder.id} title={reminder.title} detail={`${reminder.due_date || 'No due date'} • ${formatEnumLabel(reminder.status)}`} />
          ))}
        </RelatedList>

        <RelatedList title="Issues" empty="No issues linked to this repair.">
          {issues.map((issue) => (
            <RelatedItem key={issue.id} title={issue.title} detail={`${formatEnumLabel(issue.status)} • ${formatEnumLabel(issue.severity)}`} href={`/issues/${issue.id}`} />
          ))}
        </RelatedList>

        <RelatedList title="Trends" empty="No related trends found.">
          {trendFlags.map((flag) => (
            <RelatedItem key={flag.id} title={flag.title} detail={`${formatEnumLabel(flag.status)} • ${formatEnumLabel(flag.severity)}`} />
          ))}
        </RelatedList>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ActionLink href="/repairs" variant="secondary">Back to repairs</ActionLink>
          <ActionLink href="/dashboard" variant="secondary">Back to dashboard</ActionLink>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete ${repair.title}?`}
        description="This cannot be undone."
        confirmLabel="Delete repair"
        cancelLabel="Cancel"
        busy={acting}
        onConfirm={deleteRepair}
        onCancel={() => {
          if (!acting) {
            setConfirmingDelete(false);
          }
        }}
      />
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

function RelatedItem({ title, detail, href }: { title: string; detail: string; href?: string }) {
  const content = (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{detail}</div>
    </div>
  );

  return href ? (
    <Link href={href} style={{ color: 'inherit', textDecoration: 'none' }}>
      {content}
    </Link>
  ) : content;
}
