import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SERVICE_TYPES, formatEnumLabel, sortEnumForDisplay, UTILITY_TYPES } from '@home-folder/shared';
import { Button, Card, PageHeader, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import { ViewOnlyNotice } from '../../components/ViewOnlyNotice';
import { usePropertyAccess } from '../../lib/access';
import { RelatedDocuments } from '../../components/RelatedDocuments';
import { RelatedReceipts } from '../../components/RelatedReceipts';
import { getDemoRooms } from '../../lib/demoStorage';
import {
  getAvailableLocationPresets,
  isLocationPresetValue,
  resolveLocationRoomId,
  rollbackCreatedLocation
} from '../../lib/locationPresets';
import {
  getDocumentDataContext,
  getDocumentsForLink,
  type DocumentDataContext,
  type DocumentRow
} from '../../lib/documents';
import { getIssueDataContext, getIssuesForUtility, type IssueRow } from '../../lib/issues';
import { getReminderDataContext, getRemindersForUtility, type ReminderRow } from '../../lib/reminders';
import { getReceiptDataContext, getReceiptsForLink, type ReceiptDataContext, type ReceiptRow } from '../../lib/receipts';
import { getRepairDataContext, getRepairsForUtility, type RepairRow } from '../../lib/repairs';
import { getRoomsForProperty } from '../../lib/rooms';
import { formatRoomLocation } from '../../lib/roomLabels';
import {
  createServiceRecordForContext,
  getServiceRecordDataContext,
  getServiceRecordsForUtility,
  type ServiceRecordDataContext,
  type ServiceRecordRow,
  type ServiceRecordType
} from '../../lib/serviceRecords';
import { getTrendFlagDataContext, getTrendFlagsForUtility, type TrendFlagRow } from '../../lib/trendFlags';
import {
  deleteUtilityForContext,
  getUtilityByIdForContext,
  getUtilityDataContext,
  updateUtilityForContext,
  type UtilityDataContext,
  type UtilityDataMode,
  type UtilityRow,
  type UtilityType
} from '../../lib/utilities';

type RoomOption = {
  id: string;
  name: string;
  room_type?: string | null;
  floor_name?: string | null;
};

const fieldStyle = {
  padding: 10,
  borderRadius: 4,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)'
};

// The example service shown in the form matches what the utility actually is —
// a water heater should never suggest a furnace tune-up (launch QA 2026-08-03).
const SERVICE_EXAMPLES: Partial<Record<UtilityType, string>> = {
  main_water_shutoff: 'Shut-off valve exercised',
  electrical_panel: 'Panel inspected',
  breaker_panel: 'Panel inspected',
  gas_shutoff: 'Gas line inspected',
  water_heater: 'Water heater flushed',
  hvac_unit: 'Annual HVAC service',
  furnace: 'Annual furnace tune-up',
  air_conditioner: 'AC coils cleaned',
  sump_pump: 'Sump pump tested',
  irrigation_shutoff: 'Sprinklers winterized',
  internet_modem: 'Modem replaced',
  router: 'Router replaced',
  smoke_detector: 'Batteries replaced',
  carbon_monoxide_detector: 'Batteries replaced'
};

function serviceExampleFor(utilityType: UtilityType): string {
  return SERVICE_EXAMPLES[utilityType] || 'Annual service';
}

export default function UtilityDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const utilityId = typeof id === 'string' ? id : '';

  const access = usePropertyAccess();
  const [context, setContext] = useState<UtilityDataContext | null>(null);
  const [dataMode, setDataMode] = useState<UtilityDataMode>('demo');
  const [utility, setUtility] = useState<UtilityRow | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [repairs, setRepairs] = useState<RepairRow[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
  const [serviceRecordContext, setServiceRecordContext] = useState<ServiceRecordDataContext | null>(null);
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [serviceTitle, setServiceTitle] = useState('');
  const [serviceType, setServiceType] = useState<ServiceRecordType>('maintenance');
  const [serviceDate, setServiceDate] = useState('');
  const [serviceProvider, setServiceProvider] = useState('');
  const [serviceCost, setServiceCost] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');
  const [serviceNextDate, setServiceNextDate] = useState('');
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceError, setServiceError] = useState('');
  const [documentContext, setDocumentContext] = useState<DocumentDataContext | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [receiptContext, setReceiptContext] = useState<ReceiptDataContext | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [trendFlags, setTrendFlags] = useState<TrendFlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState('');
  const [utilityType, setUtilityType] = useState<UtilityType>('other');
  const [roomId, setRoomId] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [emergencyNotes, setEmergencyNotes] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!utilityId) {
        return;
      }

      setLoading(true);
      setError('');
      setFormError('');

      try {
        const [nextContext, reminderContext, repairContext, nextServiceRecordContext, nextDocumentContext, nextReceiptContext, issueContext, trendFlagContext] = await Promise.all([
          getUtilityDataContext(),
          getReminderDataContext(),
          getRepairDataContext(),
          getServiceRecordDataContext(),
          getDocumentDataContext(),
          getReceiptDataContext(),
          getIssueDataContext(),
          getTrendFlagDataContext()
        ]);

        const [nextUtility, roomRows, nextReminders, nextRepairs, nextServiceRecords, nextDocuments, nextReceipts, nextIssues, nextTrendFlags] = await Promise.all([
          getUtilityByIdForContext(nextContext, utilityId),
          nextContext.mode === 'supabase' && nextContext.property
            ? getRoomsForProperty(nextContext.property.id)
            : Promise.resolve(getDemoRooms()),
          getRemindersForUtility(reminderContext, utilityId),
          getRepairsForUtility(repairContext, utilityId),
          getServiceRecordsForUtility(nextServiceRecordContext, utilityId),
          getDocumentsForLink(nextDocumentContext, { field: 'utility_id', id: utilityId }),
          getReceiptsForLink(nextReceiptContext, { field: 'utility_id', id: utilityId }),
          getIssuesForUtility(issueContext, utilityId),
          getTrendFlagsForUtility(trendFlagContext, utilityId)
        ]);

        if (!isMounted) {
          return;
        }

        setContext(nextContext);
        setDataMode(nextContext.mode);
        setUtility(nextUtility);
        setRooms(roomRows);
        setReminders(nextReminders);
        setRepairs(nextRepairs);
        setServiceRecords(nextServiceRecords);
        setServiceRecordContext(nextServiceRecordContext);
        setDocumentContext(nextDocumentContext);
        setDocuments(nextDocuments);
        setReceiptContext(nextReceiptContext);
        setReceipts(nextReceipts);
        setIssues(nextIssues);
        setTrendFlags(nextTrendFlags);

        if (nextUtility) {
          setName(nextUtility.name);
          setUtilityType(nextUtility.utility_type);
          setRoomId(nextUtility.room_id || '');
          setLocationNotes(nextUtility.location_notes || '');
          setEmergencyNotes(nextUtility.emergency_notes || '');
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load utility.');
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
  }, [utilityId]);

  // Arriving from "Add utility" with a last-service date opens the service
  // history form prefilled, so the log gets completed rather than forgotten.
  const serviceCardRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToServiceForm = useRef(false);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const queryServiceDate = router.query.serviceDate;
    const prefillDate = Array.isArray(queryServiceDate) ? queryServiceDate[0] : queryServiceDate;
    if (prefillDate) {
      setServiceDate(prefillDate);
      setServiceFormOpen(true);
      shouldScrollToServiceForm.current = true;
    }
  }, [router.isReady, router.query.serviceDate]);

  // Landing at the top of the page with the form somewhere below is a hunt;
  // the handoff should put the form in the middle of the screen.
  useEffect(() => {
    if (loading || !serviceFormOpen || !shouldScrollToServiceForm.current) {
      return;
    }

    shouldScrollToServiceForm.current = false;
    window.requestAnimationFrame(() => {
      serviceCardRef.current?.scrollIntoView({ block: 'center' });
    });
  }, [loading, serviceFormOpen]);

  const addServiceRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!serviceRecordContext || !utility) return;

    if (!serviceTitle.trim()) {
      setServiceError(`Give the service a short title — "${serviceExampleFor(utility.utility_type)}".`);
      return;
    }
    if (!serviceDate) {
      setServiceError('When was the service done?');
      return;
    }

    const parsedCost = serviceCost.trim() ? Number(serviceCost) : null;
    if (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
      setServiceError('Cost should be a number, or left blank.');
      return;
    }

    setServiceSaving(true);
    setServiceError('');

    try {
      const created = await createServiceRecordForContext(serviceRecordContext, {
        service_title: serviceTitle.trim(),
        service_type: serviceType,
        service_date: serviceDate,
        provider_name: serviceProvider.trim() || null,
        cost: parsedCost,
        notes: serviceNotes.trim() || null,
        next_service_date: serviceNextDate || null,
        utility_id: utility.id,
        room_id: utility.room_id || null
      });
      setServiceRecords((current) => [created, ...current]);
      setServiceFormOpen(false);
      setServiceTitle('');
      setServiceType('maintenance');
      setServiceDate('');
      setServiceProvider('');
      setServiceCost('');
      setServiceNotes('');
      setServiceNextDate('');
    } catch (saveError) {
      setServiceError(saveError instanceof Error ? saveError.message : 'Failed to save the service record.');
    } finally {
      setServiceSaving(false);
    }
  };

  const roomName = utility?.room_id
    ? formatRoomLocation(rooms.find((room) => room.id === utility.room_id) || { name: 'Room was deleted' })
    : 'Not assigned';

  const locationPresets = useMemo(() => getAvailableLocationPresets(rooms), [rooms]);

  const saveUtility = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!context || !utility) return;

    if (!name.trim()) {
      setFormError('Utility name is required.');
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
      const wasPreset = isLocationPresetValue(roomId);
      const resolved = await resolveLocationRoomId(roomId, resolutionContext);
      createdRoomId = resolved.createdRoomId;

      const updatedUtility = await updateUtilityForContext(context, utility.id, {
        name,
        utility_type: utilityType,
        room_id: resolved.roomId,
        location_notes: locationNotes,
        emergency_notes: emergencyNotes
      });

      if (updatedUtility) {
        setUtility(updatedUtility);
        setRoomId(updatedUtility.room_id || '');
      }

      if (wasPreset) {
        const refreshedRooms =
          context.mode === 'supabase' && context.property
            ? await getRoomsForProperty(context.property.id)
            : getDemoRooms();
        setRooms(refreshedRooms);
      }
    } catch (saveError) {
      // Don't leave behind a room created for a preset whose save then failed.
      await rollbackCreatedLocation(createdRoomId, resolutionContext);
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to update utility.');
    } finally {
      setSaving(false);
    }
  };

  const deleteUtility = async () => {
    if (!context || !utility) return;

    if (!window.confirm('Delete this utility location?')) {
      return;
    }

    setDeleting(true);
    setFormError('');

    try {
      await deleteUtilityForContext(context, utility.id);
      router.push('/utilities');
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : 'Failed to delete utility.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Utility" />
        <Card>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading utility...</p>
        </Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Utility error" />
        <Card>
          <p style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p>
          <ActionLink href="/utilities" variant="secondary">Back to utilities</ActionLink>
        </Card>
      </>
    );
  }

  if (!utility) {
    return (
      <>
        <PageHeader title="Utility not found" />
        <Card>
          <p style={{ color: 'var(--text-muted)' }}>
            This utility may have been removed, or it may not belong to the current property.
          </p>
          <ActionLink href="/utilities" variant="secondary">Back to utilities</ActionLink>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={utility.name} description={formatEnumLabel(utility.utility_type)}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ActionLink href="/utilities" variant="secondary">Back to utilities</ActionLink>
          <ActionLink href="/dashboard" variant="secondary">Back to dashboard</ActionLink>
        </div>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? 'var(--status-good)' : 'var(--text-muted)' }}>
            {dataMode === 'supabase'
              ? 'Saved to your account.'
              : 'Demo data is stored only in this browser.'}
          </p>
          {formError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>{formError}</p>
          ) : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Utility snapshot</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <UtilityBadge label={formatEnumLabel(utility.utility_type)} />
            <UtilityBadge label={roomName} />
            <UtilityBadge label={`${reminders.length} reminder${reminders.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${repairs.length} repair${repairs.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${serviceRecords.length} service history item${serviceRecords.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${documents.length} document${documents.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${receipts.length} receipt${receipts.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${issues.length} issue${issues.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${trendFlags.length} trend${trendFlags.length === 1 ? '' : 's'}`} />
          </div>
          {utility.location_notes ? <p><strong>Location:</strong> {utility.location_notes}</p> : null}
          {utility.emergency_notes ? <p style={{ color: 'var(--status-urgent)' }}><strong>Emergency:</strong> {utility.emergency_notes}</p> : null}
          {utility.device_id ? (
            <div style={{ marginTop: 12 }}>
              <p style={{ margin: '0 0 8px', color: 'var(--text-muted)' }}>
                This utility is also a smart home device — the two records are linked.
              </p>
              <ActionLink href={`/automation/devices/${utility.device_id}`} variant="secondary">
                Open smart device record
              </ActionLink>
            </div>
          ) : null}
        </Card>

        <Card tone="dark">
          <h2 style={{ marginTop: 0 }}>Something wrong with this utility?</h2>
          <p style={{ color: 'rgba(255,248,234,0.78)' }}>
            Start a repair record for it — describe the problem, note when the technician is
            coming, then build a service call sheet you can text or email to them with the
            location, shut-offs, and address.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <ActionLink
              href={`/repairs?utilityId=${encodeURIComponent(utility.id)}${utility.room_id ? `&roomId=${encodeURIComponent(utility.room_id)}` : ''}&title=${encodeURIComponent(utility.name)}`}
            >
              Report a problem
            </ActionLink>
            {repairs.length > 0 ? (
              <ActionLink href={`/repairs/${repairs[0].id}/service-call`} variant="secondary">
                Service call sheet for latest repair
              </ActionLink>
            ) : null}
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Edit utility</h2>
          {!access.loading && !access.canWrite ? (
            <ViewOnlyNotice role={access.role} action="edit this utility" inline />
          ) : (
          <form onSubmit={saveUtility} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} style={fieldStyle} />
            </label>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Type</span>
                <select value={utilityType} onChange={(event) => setUtilityType(event.target.value as UtilityType)} style={fieldStyle}>
                  {sortEnumForDisplay(UTILITY_TYPES).map((type) => (
                    <option key={type} value={type}>{formatEnumLabel(type)}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Location</span>
                <select value={roomId} onChange={(event) => setRoomId(event.target.value)} style={fieldStyle}>
                  <option value="">Not assigned</option>
                  {rooms.length > 0 ? (
                    <optgroup label="Rooms & spaces">
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>{formatRoomLocation(room)}</option>
                      ))}
                    </optgroup>
                  ) : null}
                  {locationPresets.length > 0 ? (
                    <optgroup label="Outdoor & exterior">
                      {locationPresets.map((preset) => (
                        <option key={preset.value} value={preset.value}>{preset.label}</option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </label>
            </div>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Location notes</span>
              <textarea value={locationNotes} onChange={(event) => setLocationNotes(event.target.value)} style={{ ...fieldStyle, minHeight: 72 }} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Emergency notes</span>
              <textarea value={emergencyNotes} onChange={(event) => setEmergencyNotes(event.target.value)} style={{ ...fieldStyle, minHeight: 72 }} />
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
              <button
                type="button"
                onClick={deleteUtility}
                disabled={deleting}
                style={{
                  padding: '10px 14px',
                  borderRadius: 6,
                  border: '1px solid rgba(163,78,51,0.30)',
                  background: 'rgba(163,78,51,0.08)',
                  color: 'var(--status-urgent)',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  opacity: deleting ? 0.7 : 1
                }}
              >
                {deleting ? 'Deleting...' : 'Delete utility'}
              </button>
            </div>
          </form>
          )}
        </Card>

        <RelatedList
          title="Reminders"
          empty="No reminders linked to this utility."
          action={<ActionLink href={`/reminders?utilityId=${encodeURIComponent(utility.id)}`} variant="secondary">Add reminder</ActionLink>}
        >
          {reminders.map((reminder) => (
            <RelatedItem key={reminder.id} title={reminder.title} detail={`${reminder.due_date || 'No due date'} • ${formatEnumLabel(reminder.status)}`} />
          ))}
        </RelatedList>

        <RelatedList
          title="Repairs"
          empty="No repairs linked to this utility."
          action={
            <ActionLink
              href={`/repairs?utilityId=${encodeURIComponent(utility.id)}${utility.room_id ? `&roomId=${encodeURIComponent(utility.room_id)}` : ''}&title=${encodeURIComponent(utility.name)}`}
              variant="secondary"
            >
              Add repair
            </ActionLink>
          }
        >
          {repairs.map((repair) => (
            <RelatedItem key={repair.id} title={repair.title} detail={`${repair.reported_date || 'No reported date'} • ${formatEnumLabel(repair.status)}`} href={`/repairs/${repair.id}`} />
          ))}
        </RelatedList>

        <div ref={serviceCardRef}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Service History</h2>
            {!serviceFormOpen && (access.loading || access.canWrite) ? (
              <Button type="button" variant="secondary" onClick={() => setServiceFormOpen(true)}>
                Add service history
              </Button>
            ) : null}
          </div>
          {serviceFormOpen ? (
            <form onSubmit={addServiceRecord} style={{ display: 'grid', gap: 12, marginTop: 16, border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>What was done</span>
                  <input value={serviceTitle} onChange={(event) => setServiceTitle(event.target.value)} placeholder={serviceExampleFor(utility.utility_type)} style={fieldStyle} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Type</span>
                  <select value={serviceType} onChange={(event) => setServiceType(event.target.value as ServiceRecordType)} style={fieldStyle}>
                    {sortEnumForDisplay(SERVICE_TYPES).map((type) => (
                      <option key={type} value={type}>{formatEnumLabel(type)}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Service date</span>
                  <input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} style={fieldStyle} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Who did the work</span>
                  <input value={serviceProvider} onChange={(event) => setServiceProvider(event.target.value)} placeholder="Company or person" style={fieldStyle} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Cost</span>
                  <input value={serviceCost} onChange={(event) => setServiceCost(event.target.value)} inputMode="decimal" placeholder="180" style={fieldStyle} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Next service due</span>
                  <input type="date" value={serviceNextDate} onChange={(event) => setServiceNextDate(event.target.value)} style={fieldStyle} />
                </label>
              </div>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Notes</span>
                <textarea value={serviceNotes} onChange={(event) => setServiceNotes(event.target.value)} style={{ ...fieldStyle, minHeight: 60 }} />
              </label>
              {serviceError ? (
                <p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }} role="alert">{serviceError}</p>
              ) : null}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button type="submit" disabled={serviceSaving}>{serviceSaving ? 'Saving...' : 'Save service record'}</Button>
                <Button type="button" variant="secondary" onClick={() => { setServiceFormOpen(false); setServiceError(''); }} disabled={serviceSaving}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
          <div style={{ marginTop: 16 }}>
            {serviceRecords.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {serviceRecords.map((record) => (
                  <RelatedItem key={record.id} title={record.service_title} detail={`${record.service_date} • ${formatEnumLabel(record.service_type)}`} />
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>No service history linked to this utility.</p>
            )}
          </div>
        </Card>
        </div>

        <RelatedDocuments
          documents={documents}
          context={documentContext}
          uploadHref={`/documents?utilityId=${utility.id}`}
          empty="No documents linked to this utility."
        />

        <RelatedReceipts
          receipts={receipts}
          context={receiptContext}
          uploadHref={`/receipts?utilityId=${utility.id}`}
          empty="No receipts linked to this utility."
        />

        <RelatedList
          title="Issues"
          empty="No issues linked to this utility."
          action={<ActionLink href={`/issues?utilityId=${encodeURIComponent(utility.id)}`} variant="secondary">Add issue</ActionLink>}
        >
          {issues.map((issue) => (
            <RelatedItem key={issue.id} title={issue.title} detail={`${formatEnumLabel(issue.status)} • ${formatEnumLabel(issue.severity)}`} href={`/issues/${issue.id}`} />
          ))}
        </RelatedList>

        <RelatedList title="Trends" empty="No trends linked to this utility.">
          {trendFlags.map((flag) => (
            <RelatedItem key={flag.id} title={flag.title} detail={`${formatEnumLabel(flag.status)} • ${formatEnumLabel(flag.severity)}`} />
          ))}
        </RelatedList>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ActionLink href="/utilities" variant="secondary">Back to utilities</ActionLink>
          <ActionLink href="/dashboard" variant="secondary">Back to dashboard</ActionLink>
        </div>
      </div>
    </>
  );
}

function RelatedList({ title, empty, action, children }: { title: string; empty: string; action?: React.ReactNode; children: React.ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {action}
      </div>
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
