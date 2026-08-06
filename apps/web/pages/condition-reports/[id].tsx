import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CONDITION_RATINGS,
  CONDITION_REPORT_TYPES,
  formatCalendarDate,
  formatEnumLabel,
  type ConditionRating,
  type ConditionReportType
} from '@home-folder/shared';
import { Button, Card, ConfirmDialog, PageHeader, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import { usePropertyAccess } from '../../lib/access';
import { RoomLocationSelect, roomSelectionValue } from '../../components/RoomLocationSelect';
import {
  attachConditionPhoto,
  buildDepositPacket,
  completeReport,
  createEntry,
  deleteEntry,
  getConditionReport,
  updateConditionReport,
  updateEntry,
  type ConditionReportDocument,
  type ConditionReportEntryRow,
  type ConditionReportRow
} from '../../lib/conditionReports';
import { resolveDataContext, type ResolvedDataContext } from '../../lib/dataContext';
import { resolveLocationRoomId, rollbackCreatedLocation } from '../../lib/locationPresets';
import { getRoomsForProperty, type RoomWithFloor } from '../../lib/rooms';
import { listTenancies, type TenancyRow } from '../../lib/tenancies';

const fieldStyle = {
  padding: 10,
  borderRadius: 4,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)'
};

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  return formatCalendarDate(value) || value;
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * One-tap photo capture, mirroring PhotoCaptureButton but attaching the photo
 * as a condition_photo with the report/entry FKs (which the shared component's
 * props cannot target).
 */
function ConditionPhotoButton({
  label,
  busy,
  disabled,
  onFile
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFile(file);
          }
          if (inputRef.current) {
            inputRef.current.value = '';
          }
        }}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Saving photo…' : label}
      </Button>
    </span>
  );
}

export default function ConditionReportDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const reportId = typeof id === 'string' ? id : '';

  const access = usePropertyAccess();
  const [context, setContext] = useState<ResolvedDataContext | null>(null);
  const [report, setReport] = useState<ConditionReportRow | null>(null);
  const [entries, setEntries] = useState<ConditionReportEntryRow[]>([]);
  const [documents, setDocuments] = useState<ConditionReportDocument[]>([]);
  const [rooms, setRooms] = useState<RoomWithFloor[]>([]);
  const [tenancies, setTenancies] = useState<TenancyRow[]>([]);
  const [tenancy, setTenancy] = useState<TenancyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [actingEntryId, setActingEntryId] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  // Two-step confirmation: these buttons only open a ConfirmDialog; nothing
  // happens until the dialog is confirmed. window.confirm proved unreliable
  // (a suppressed dialog returns false and the click dies silently).
  const [entryDeleteTarget, setEntryDeleteTarget] = useState<ConditionReportEntryRow | null>(null);
  const [completePromptOpen, setCompletePromptOpen] = useState(false);

  const [entryRoomId, setEntryRoomId] = useState('');
  const [entryRoomName, setEntryRoomName] = useState('');
  const [entryAreaLabel, setEntryAreaLabel] = useState('');
  const [entryRating, setEntryRating] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [roomDraft, setRoomDraft] = useState('');
  const [roomNameDraft, setRoomNameDraft] = useState('');
  const [areaLabelDraft, setAreaLabelDraft] = useState('');

  const [editingReport, setEditingReport] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [reportTypeDraft, setReportTypeDraft] = useState<ConditionReportType>('move_in');
  const [reportDateDraft, setReportDateDraft] = useState('');
  const [reportTenancyDraft, setReportTenancyDraft] = useState('');
  const [conductedByDraft, setConductedByDraft] = useState('');
  const [summaryDraft, setSummaryDraft] = useState('');
  const [reportNotesDraft, setReportNotesDraft] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!reportId) return;

      setLoading(true);
      setError('');

      try {
        const nextContext = await resolveDataContext();

        if (nextContext.mode !== 'supabase' || !nextContext.property) {
          if (isMounted) {
            setContext(nextContext);
          }
          return;
        }

        const [detail, roomRows, tenancyRows] = await Promise.all([
          getConditionReport(reportId),
          getRoomsForProperty(nextContext.property.id),
          listTenancies(nextContext.property.id)
        ]);

        if (!isMounted) return;

        setContext(nextContext);
        setRooms(roomRows);
        setTenancies(tenancyRows);

        // Only show reports that belong to the active property.
        if (detail && detail.report.property_id === nextContext.property.id) {
          setReport(detail.report);
          setEntries(detail.entries);
          setDocuments(detail.documents);
          setTenancy(
            detail.report.tenancy_id
              ? tenancyRows.find((row) => row.id === detail.report.tenancy_id) || null
              : null
          );
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load condition report.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [reportId]);

  const roomNameById = useMemo(() => new Map(rooms.map((room) => [room.id, room.name])), [rooms]);

  const entryLabel = (entry: ConditionReportEntryRow) =>
    entry.area_label || (entry.room_id ? roomNameById.get(entry.room_id) || 'Room' : 'General');

  const photoCountForEntry = (entryId: string) =>
    documents.filter(
      (doc) => doc.document_type === 'condition_photo' && doc.condition_report_entry_id === entryId
    ).length;

  const packet = useMemo(() => {
    if (!report || !context?.property) return null;

    return buildDepositPacket(
      report,
      entries.map((entry) => ({
        ...entry,
        room_name: entry.room_id ? roomNameById.get(entry.room_id) || null : null
      })),
      documents,
      context.property.nickname,
      tenancy
    );
  }, [report, entries, documents, context, tenancy, roomNameById]);

  const isCompleted = report?.status === 'completed';

  /** Rooms named mid-walkthrough have to join the list the pickers read from. */
  const refreshRooms = async () => {
    if (!context?.property) return;

    try {
      setRooms(await getRoomsForProperty(context.property.id));
    } catch {
      // The room exists either way; the picker catches up on the next load.
    }
  };

  const submitEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!report || !context?.property) return;

    const roomValue = roomSelectionValue(entryRoomId, entryRoomName);
    if (roomValue === null) {
      setError('Name the new room, or choose one already on file.');
      return;
    }

    if (!roomValue && !entryAreaLabel.trim()) {
      setError('Choose a room or enter an area label for this entry.');
      return;
    }

    setSavingEntry(true);

    const resolutionContext = { mode: 'supabase', propertyId: context.property.id } as const;
    let createdRoomId: string | null = null;

    try {
      const resolved = await resolveLocationRoomId(roomValue, resolutionContext);
      createdRoomId = resolved.createdRoomId;

      const created = await createEntry({
        report_id: report.id,
        property_id: context.property.id,
        room_id: resolved.roomId,
        area_label: entryAreaLabel || null,
        condition_rating: (entryRating || null) as ConditionRating | null,
        notes: entryNotes || null,
        sort_order: entries.length
      });

      setEntries((current) => [...current, created]);
      setEntryRoomId('');
      setEntryRoomName('');
      setEntryAreaLabel('');
      setEntryRating('');
      setEntryNotes('');

      if (createdRoomId) {
        await refreshRooms();
      }
    } catch (saveError) {
      // A room named for this entry should not outlive a failed entry.
      await rollbackCreatedLocation(createdRoomId, resolutionContext);
      setError(saveError instanceof Error ? saveError.message : 'Failed to add entry.');
    } finally {
      setSavingEntry(false);
    }
  };

  const startEditingReport = () => {
    if (!report) return;

    setEditingReport(true);
    setReportTypeDraft(report.report_type);
    setReportDateDraft(report.report_date);
    setReportTenancyDraft(report.tenancy_id || '');
    setConductedByDraft(report.conducted_by || '');
    setSummaryDraft(report.summary || '');
    setReportNotesDraft(report.notes || '');
    setError('');
  };

  const saveReport = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!report) return;

    if (!reportDateDraft) {
      setError('A report date is required.');
      return;
    }

    setSavingReport(true);

    try {
      const updated = await updateConditionReport(report.id, {
        report_type: reportTypeDraft,
        report_date: reportDateDraft,
        tenancy_id: reportTenancyDraft || null,
        conducted_by: conductedByDraft || null,
        summary: summaryDraft || null,
        notes: reportNotesDraft || null
      });

      setReport(updated);
      setTenancy(
        updated.tenancy_id ? tenancies.find((row) => row.id === updated.tenancy_id) || null : null
      );
      setEditingReport(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update report.');
    } finally {
      setSavingReport(false);
    }
  };

  const changeEntryRating = async (entryId: string, rating: string) => {
    setActingEntryId(entryId);
    setError('');

    try {
      const updated = await updateEntry(entryId, {
        condition_rating: (rating || null) as ConditionRating | null
      });
      setEntries((current) => current.map((entry) => (entry.id === entryId ? updated : entry)));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update entry.');
    } finally {
      setActingEntryId(null);
    }
  };

  const startEditingEntry = (entry: ConditionReportEntryRow) => {
    setEditingEntryId(entry.id);
    setNoteDraft(entry.notes || '');
    setRoomDraft(entry.room_id || '');
    setRoomNameDraft('');
    setAreaLabelDraft(entry.area_label || '');
    setError('');
  };

  const cancelEditingEntry = () => {
    setEditingEntryId(null);
    setNoteDraft('');
    setRoomDraft('');
    setRoomNameDraft('');
    setAreaLabelDraft('');
  };

  /**
   * An entry filed against the wrong room used to mean deleting it and walking
   * the unit again, so the room and the area label are editable alongside the
   * notes for as long as the report is a draft.
   */
  const saveEntryDetails = async (entryId: string) => {
    if (!context?.property) return;

    const roomValue = roomSelectionValue(roomDraft, roomNameDraft);
    if (roomValue === null) {
      setError('Name the new room, or choose one already on file.');
      return;
    }

    if (!roomValue && !areaLabelDraft.trim()) {
      setError('Choose a room or enter an area label for this entry.');
      return;
    }

    setActingEntryId(entryId);
    setError('');

    const resolutionContext = { mode: 'supabase', propertyId: context.property.id } as const;
    let createdRoomId: string | null = null;

    try {
      const resolved = await resolveLocationRoomId(roomValue, resolutionContext);
      createdRoomId = resolved.createdRoomId;

      const updated = await updateEntry(entryId, {
        room_id: resolved.roomId,
        area_label: areaLabelDraft || null,
        notes: noteDraft || null
      });

      setEntries((current) => current.map((entry) => (entry.id === entryId ? updated : entry)));
      cancelEditingEntry();

      if (createdRoomId) {
        await refreshRooms();
      }
    } catch (updateError) {
      await rollbackCreatedLocation(createdRoomId, resolutionContext);
      setError(updateError instanceof Error ? updateError.message : 'Failed to update entry.');
    } finally {
      setActingEntryId(null);
    }
  };

  const requestRemoveEntry = (entry: ConditionReportEntryRow) => {
    setError('');
    setEntryDeleteTarget(entry);
  };

  const cancelRemoveEntry = () => {
    if (actingEntryId !== null) {
      return;
    }
    setEntryDeleteTarget(null);
  };

  const handleConfirmRemoveEntry = async () => {
    if (!entryDeleteTarget || actingEntryId !== null) {
      return;
    }

    const entryId = entryDeleteTarget.id;

    setActingEntryId(entryId);
    setError('');

    try {
      await deleteEntry(entryId);
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
      setEntryDeleteTarget(null);
    } catch (deleteError) {
      // Close the dialog so the error is readable on the page.
      setEntryDeleteTarget(null);
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to remove entry.');
    } finally {
      setActingEntryId(null);
    }
  };

  const uploadPhoto = async (file: File, entry: ConditionReportEntryRow | null) => {
    if (!report || !context) return;

    const key = entry ? entry.id : 'report';
    setUploadingKey(key);
    setError('');

    try {
      const doc = await attachConditionPhoto(context, {
        file,
        title: `Condition photo — ${entry ? entryLabel(entry) : 'General'} — ${formatDate(report.report_date)}`,
        reportId: report.id,
        entryId: entry?.id || null
      });
      setDocuments((current) => [...current, doc]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to save photo.');
    } finally {
      setUploadingKey(null);
    }
  };

  const requestMarkCompleted = () => {
    setError('');
    setCompletePromptOpen(true);
  };

  const cancelMarkCompleted = () => {
    if (completing) {
      return;
    }
    setCompletePromptOpen(false);
  };

  const handleConfirmMarkCompleted = async () => {
    if (!report || completing) return;

    setCompleting(true);
    setError('');

    try {
      const updated = await completeReport(report.id);
      setReport(updated);
      setCompletePromptOpen(false);
    } catch (completeError) {
      // Close the dialog so the error is readable on the page.
      setCompletePromptOpen(false);
      setError(completeError instanceof Error ? completeError.message : 'Failed to complete report.');
    } finally {
      setCompleting(false);
    }
  };

  const printPacket = () => {
    window.print();
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Condition Report" />
        <Card>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading condition report...</p>
        </Card>
      </>
    );
  }

  if (context && context.mode !== 'supabase') {
    return (
      <>
        <PageHeader title="Condition Report" />
        <Card>
          <h2 style={{ marginTop: 0 }}>Condition evidence needs an account</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Condition reports and their photos are saved to your account only — demo mode does not
            keep landlord records in this browser. Sign in and create a property to begin the record.
          </p>
          <ActionLink href="/sign-in">Sign in</ActionLink>
        </Card>
      </>
    );
  }

  if (!report) {
    return (
      <>
        <PageHeader title={error ? 'Condition report error' : 'Condition report not found'} />
        <Card>
          <p style={{ color: error ? 'var(--status-urgent)' : 'var(--text-muted)', fontWeight: error ? 700 : 400 }}>
            {error || 'This report may have been removed, or it may not belong to the current property.'}
          </p>
          <ActionLink href="/condition-reports" variant="secondary">Back to condition reports</ActionLink>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="cr-no-print">
        <PageHeader
          title={`${formatEnumLabel(report.report_type)} Report`}
          description={`${formatDate(report.report_date)} · ${context?.property?.nickname || 'Property'}`}
        />
      </div>

      <div className="cr-no-print" style={{ display: 'grid', gap: 24 }}>
        <Card>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <UtilityBadge label={formatEnumLabel(report.status)} />
            <UtilityBadge label={`${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`} />
            <UtilityBadge label={`${documents.filter((doc) => doc.document_type === 'condition_photo').length} photo${documents.filter((doc) => doc.document_type === 'condition_photo').length === 1 ? '' : 's'}`} />
            {tenancy ? <UtilityBadge label={`Tenancy: ${tenancy.label}`} /> : null}
          </div>
          <div style={{ color: 'var(--text-muted)', display: 'grid', gap: 6 }}>
            <div><strong>Report date:</strong> {formatDate(report.report_date)}</div>
            {report.conducted_by && <div><strong>Conducted by:</strong> {report.conducted_by}</div>}
            <div><strong>Started:</strong> {formatDateTime(report.created_at)} (recorded automatically)</div>
            {report.completed_at && (
              <div><strong>Completed:</strong> {formatDateTime(report.completed_at)} (recorded automatically)</div>
            )}
            {report.summary && <div><strong>Summary:</strong> {report.summary}</div>}
            {report.notes && <div><strong>Notes:</strong> {report.notes}</div>}
          </div>
          {error ? (
            <p style={{ color: 'var(--status-urgent)', fontWeight: 700, marginBottom: 0 }}>{error}</p>
          ) : null}
        </Card>

        {!isCompleted && (access.loading || access.canWrite) ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Edit report</h2>
            {editingReport ? (
              <form onSubmit={saveReport} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>Report type</span>
                    <select
                      value={reportTypeDraft}
                      onChange={(event) => setReportTypeDraft(event.target.value as ConditionReportType)}
                      style={fieldStyle}
                    >
                      {CONDITION_REPORT_TYPES.map((type) => (
                        <option key={type} value={type}>{formatEnumLabel(type)}</option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>Report date</span>
                    <input
                      type="date"
                      value={reportDateDraft}
                      onChange={(event) => setReportDateDraft(event.target.value)}
                      style={fieldStyle}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>Tenancy</span>
                    <select
                      value={reportTenancyDraft}
                      onChange={(event) => setReportTenancyDraft(event.target.value)}
                      style={fieldStyle}
                    >
                      <option value="">Not linked</option>
                      {tenancies.map((row) => (
                        <option key={row.id} value={row.id}>{row.label}</option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>Conducted by</span>
                    <input
                      value={conductedByDraft}
                      onChange={(event) => setConductedByDraft(event.target.value)}
                      placeholder="Who walked the unit"
                      style={fieldStyle}
                    />
                  </label>
                </div>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Summary</span>
                  <textarea
                    value={summaryDraft}
                    onChange={(event) => setSummaryDraft(event.target.value)}
                    style={{ ...fieldStyle, minHeight: 70 }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Notes</span>
                  <textarea
                    value={reportNotesDraft}
                    onChange={(event) => setReportNotesDraft(event.target.value)}
                    style={{ ...fieldStyle, minHeight: 70 }}
                  />
                </label>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Button type="submit" disabled={savingReport}>
                    {savingReport ? 'Saving...' : 'Save changes'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={savingReport}
                    onClick={() => setEditingReport(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
                  Correct the report type, date, tenancy, or notes while this report is still a draft.
                  Once it is completed the record is fixed.
                </p>
                <Button type="button" onClick={startEditingReport}>Edit report details</Button>
              </>
            )}
          </Card>
        ) : null}

        {!isCompleted && (access.loading || access.canWrite) ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Add entry</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
              One entry per room or area. Attach photos to each entry — every capture is timestamped
              automatically.
            </p>
            <form onSubmit={submitEntry} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <RoomLocationSelect
                  rooms={rooms}
                  value={entryRoomId}
                  onChange={setEntryRoomId}
                  customName={entryRoomName}
                  onCustomNameChange={setEntryRoomName}
                  label="Room"
                  emptyLabel="Not a saved room"
                  disabled={savingEntry}
                />

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Or area label</span>
                  <input
                    value={entryAreaLabel}
                    onChange={(event) => setEntryAreaLabel(event.target.value)}
                    placeholder="Hallway, balcony, exterior door…"
                    style={fieldStyle}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Condition</span>
                  <select value={entryRating} onChange={(event) => setEntryRating(event.target.value)} style={fieldStyle}>
                    <option value="">Not rated</option>
                    {CONDITION_RATINGS.map((rating) => (
                      <option key={rating} value={rating}>{formatEnumLabel(rating)}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Notes</span>
                <textarea
                  value={entryNotes}
                  onChange={(event) => setEntryNotes(event.target.value)}
                  placeholder="Scuffs on the west wall, carpet stain by the window…"
                  style={{ ...fieldStyle, minHeight: 70 }}
                />
              </label>

              <div>
                <Button type="submit" disabled={savingEntry}>
                  {savingEntry ? 'Adding entry...' : 'Add entry'}
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Card>
            <h2 style={{ marginTop: 0 }}>This report is completed</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
              Completed {formatDateTime(report.completed_at)}. Entries and photos are locked so the
              evidence trail stays intact. Print the deposit packet below.
            </p>
          </Card>
        )}

        <Card>
          <h2 style={{ marginTop: 0 }}>Entries ({entries.length})</h2>
          {entries.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              No entries yet. Walk the unit room by room and add one entry per area.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {entries.map((entry) => {
                const photoCount = photoCountForEntry(entry.id);
                const isActing = actingEntryId === entry.id;

                return (
                  <div key={entry.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
                      <div>
                        <h3 style={{ margin: '0 0 8px 0' }}>{entryLabel(entry)}</h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          {entry.condition_rating ? (
                            <UtilityBadge label={formatEnumLabel(entry.condition_rating)} />
                          ) : (
                            <UtilityBadge label="Not rated" />
                          )}
                          <UtilityBadge label={`${photoCount} photo${photoCount === 1 ? '' : 's'}`} />
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'grid', gap: 4 }}>
                          <div><strong>Recorded:</strong> {formatDateTime(entry.created_at)}</div>
                          {editingEntryId === entry.id ? (
                            <div style={{ display: 'grid', gap: 10 }}>
                              <RoomLocationSelect
                                rooms={rooms}
                                value={roomDraft}
                                onChange={setRoomDraft}
                                customName={roomNameDraft}
                                onCustomNameChange={setRoomNameDraft}
                                label="Room"
                                emptyLabel="Not a saved room"
                                disabled={isActing}
                              />
                              <label style={{ display: 'grid', gap: 6 }}>
                                <span style={{ fontWeight: 600 }}>Area label</span>
                                <input
                                  value={areaLabelDraft}
                                  onChange={(event) => setAreaLabelDraft(event.target.value)}
                                  placeholder="Hallway, balcony, exterior door…"
                                  style={fieldStyle}
                                />
                              </label>
                              <label style={{ display: 'grid', gap: 6 }}>
                                <span style={{ fontWeight: 600 }}>Notes</span>
                                <textarea
                                  value={noteDraft}
                                  onChange={(event) => setNoteDraft(event.target.value)}
                                  style={{ ...fieldStyle, minHeight: 70 }}
                                />
                              </label>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <Button type="button" onClick={() => saveEntryDetails(entry.id)} disabled={isActing}>
                                  {isActing ? 'Saving...' : 'Save entry'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={cancelEditingEntry}
                                  disabled={isActing}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : entry.notes ? (
                            <div><strong>Notes:</strong> {entry.notes}</div>
                          ) : null}
                        </div>
                      </div>

                      {!isCompleted && (access.loading || access.canWrite) ? (
                        <div style={{ display: 'grid', gap: 8, minWidth: 170 }}>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Condition</span>
                            <select
                              value={entry.condition_rating || ''}
                              onChange={(event) => changeEntryRating(entry.id, event.target.value)}
                              disabled={isActing}
                              style={fieldStyle}
                            >
                              <option value="">Not rated</option>
                              {CONDITION_RATINGS.map((rating) => (
                                <option key={rating} value={rating}>{formatEnumLabel(rating)}</option>
                              ))}
                            </select>
                          </label>
                          <ConditionPhotoButton
                            label="Add photo"
                            busy={uploadingKey === entry.id}
                            disabled={Boolean(uploadingKey) || isActing}
                            onFile={(file) => uploadPhoto(file, entry)}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={isActing}
                            onClick={() => startEditingEntry(entry)}
                          >
                            Edit entry
                          </Button>
                          <button
                            type="button"
                            onClick={() => requestRemoveEntry(entry)}
                            disabled={isActing}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 6,
                              border: '1px solid rgba(163,78,51,0.30)',
                              background: 'rgba(163,78,51,0.08)',
                              color: 'var(--status-urgent)',
                              cursor: isActing ? 'not-allowed' : 'pointer',
                              opacity: isActing ? 0.7 : 1
                            }}
                          >
                            {isActing ? 'Working...' : 'Remove'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!isCompleted && (access.loading || access.canWrite) ? (
            <div style={{ marginTop: 14 }}>
              <ConditionPhotoButton
                label="Add a general photo (whole unit)"
                busy={uploadingKey === 'report'}
                disabled={Boolean(uploadingKey)}
                onFile={(file) => uploadPhoto(file, null)}
              />
            </div>
          ) : null}
        </Card>

        {!isCompleted && (access.loading || access.canWrite) ? (
          <Card tone="dark">
            <h2 style={{ marginTop: 0 }}>Finish the walkthrough</h2>
            <p style={{ color: 'rgba(255,248,234,0.78)' }}>
              Marking the report completed stamps the completion time automatically. That timestamp —
              together with each photo&apos;s capture time — is what makes this packet usable as
              deposit evidence, so entries and photos are locked afterwards.
            </p>
            <Button type="button" onClick={requestMarkCompleted} disabled={completing}>
              {completing ? 'Marking completed...' : 'Mark completed'}
            </Button>
          </Card>
        ) : null}

        <Card>
          <h2 style={{ marginTop: 0 }}>Deposit packet</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
            A paper-friendly summary of this report — per-room condition, photo counts, and the
            automatic timestamps — to deliver with the itemized deduction statement.
          </p>
          <Button type="button" onClick={printPacket}>Print deposit packet</Button>
        </Card>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ActionLink href="/condition-reports" variant="secondary">Back to condition reports</ActionLink>
          <ActionLink href="/tenancies" variant="secondary">Tenancies</ActionLink>
        </div>
      </div>

      {packet ? (
        <article
          className="deposit-packet"
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: 28,
            marginTop: 24,
            boxShadow: '0 1px 0 rgba(44,31,24,0.08)'
          }}
        >
          <div className="deposit-print-footer" style={{ display: 'none' }} aria-hidden="true">
            {packet.propertyNickname} · {formatEnumLabel(packet.reportType)} · Timestamps recorded automatically at capture · Our Home Folder
          </div>

          <header style={{ borderBottom: '2px solid var(--color-espresso)', paddingBottom: 18, marginBottom: 20 }}>
            <div style={{ color: 'var(--color-brass-deep)', fontWeight: 800, textTransform: 'uppercase', fontSize: 12 }}>
              Security deposit condition packet
            </div>
            <h1 style={{ margin: '6px 0', fontSize: 30, lineHeight: 1.1 }}>
              {packet.propertyNickname} · {formatEnumLabel(packet.reportType)}
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Report date {formatDate(packet.reportDate)}
              {packet.conductedBy ? ` · Conducted by ${packet.conductedBy}` : ''}
            </p>
          </header>

          <section style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 18 }}>Record</h2>
            <div style={{ color: 'var(--text-primary)', display: 'grid', gap: 4 }}>
              <div><strong>Status:</strong> {formatEnumLabel(packet.status)}</div>
              <div><strong>Started:</strong> {formatDateTime(packet.createdAt)}</div>
              <div><strong>Completed:</strong> {packet.completedAt ? formatDateTime(packet.completedAt) : 'Not yet completed'}</div>
              <div><strong>Entries:</strong> {packet.totalEntries} · <strong>Photos:</strong> {packet.totalPhotos}
                {packet.unassignedPhotoCount > 0 ? ` (${packet.unassignedPhotoCount} general)` : ''}
              </div>
              {packet.summary ? <div><strong>Summary:</strong> {packet.summary}</div> : null}
            </div>
          </section>

          {packet.tenancy ? (
            <section style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 18 }}>Tenancy</h2>
              <div style={{ display: 'grid', gap: 4 }}>
                <div><strong>Tenancy:</strong> {packet.tenancy.label}</div>
                {packet.tenancy.tenantNames ? <div><strong>Tenants:</strong> {packet.tenancy.tenantNames}</div> : null}
                <div>
                  <strong>Term:</strong> {formatDate(packet.tenancy.startDate)} — {formatDate(packet.tenancy.endDate)}
                </div>
                <div>
                  <strong>Security deposit:</strong>{' '}
                  {packet.tenancy.depositFormatted || 'Not recorded'}
                  {packet.tenancy.depositReturnedOn
                    ? ` · Returned ${formatDate(packet.tenancy.depositReturnedOn)}`
                    : ''}
                </div>
              </div>
            </section>
          ) : null}

          <section>
            <h2 style={{ fontSize: 18 }}>Condition by room and area</h2>
            {packet.sections.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No entries recorded on this report yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {packet.sections.map((section) => (
                  <div key={section.title} className="deposit-packet-section">
                    <h3 style={{ marginBottom: 6 }}>{section.title}</h3>
                    <ul style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 8, lineHeight: 1.5 }}>
                      {section.entries.map((entry) => (
                        <li key={entry.id}>
                          <strong>{entry.conditionRating ? formatEnumLabel(entry.conditionRating) : 'Not rated'}</strong>
                          {' · '}{entry.photoCount} photo{entry.photoCount === 1 ? '' : 's'}
                          {' · '}Recorded {formatDateTime(entry.recordedAt)}
                          {entry.notes ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.93rem', marginTop: 2 }}>{entry.notes}</div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          <footer style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 20, paddingTop: 12, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Timestamps recorded automatically at capture. Generated by Our Home Folder.
          </footer>
        </article>
      ) : null}

      <ConfirmDialog
        open={entryDeleteTarget !== null}
        title={entryDeleteTarget ? `Remove ${entryLabel(entryDeleteTarget)}?` : 'Remove this entry?'}
        description="Photos already attached to it stay in Documents."
        confirmLabel="Remove entry"
        cancelLabel="Keep entry"
        busy={actingEntryId !== null && actingEntryId === entryDeleteTarget?.id}
        onConfirm={handleConfirmRemoveEntry}
        onCancel={cancelRemoveEntry}
      />

      <ConfirmDialog
        open={completePromptOpen}
        title="Mark this report completed?"
        description="The completion time is recorded automatically and becomes part of the evidence trail. Entries and photos are locked afterwards."
        confirmLabel="Mark completed"
        cancelLabel="Cancel"
        destructive={false}
        busy={completing}
        onConfirm={handleConfirmMarkCompleted}
        onCancel={cancelMarkCompleted}
      />

      <style jsx global>{`
        @media print {
          @page {
            margin: 18mm 16mm 20mm;
          }

          nav,
          .app-gilt,
          .mobile-bottom-nav,
          .cr-no-print {
            display: none !important;
          }

          body {
            background: #fff !important;
            font-size: 12px !important;
          }

          body::before {
            display: none !important;
          }

          main {
            padding: 0 !important;
          }

          .deposit-packet,
          .deposit-packet.hb-card::before {
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin-top: 0 !important;
            background: #fff !important;
          }

          .deposit-packet h1 {
            font-size: 24px !important;
          }

          .deposit-packet h2 {
            font-size: 15px !important;
            break-after: avoid;
            page-break-after: avoid;
          }

          .deposit-packet-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .deposit-print-footer {
            display: block !important;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            font-family: var(--font-mono);
            font-size: 9px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #6b5f4e;
            border-top: 1px solid rgba(44, 31, 24, 0.2);
            padding-top: 4px;
          }

          li {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
}
