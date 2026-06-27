import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { formatEnumLabel, UTILITY_TYPES } from '@home-bible/shared';
import { Button, Card, PageHeader, UtilityBadge } from '@home-bible/ui';
import { RelatedDocuments } from '../../components/RelatedDocuments';
import { RelatedReceipts } from '../../components/RelatedReceipts';
import { getDemoRooms } from '../../lib/demoStorage';
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
import { getServiceRecordDataContext, getServiceRecordsForUtility, type ServiceRecordRow } from '../../lib/serviceRecords';
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
};

const fieldStyle = {
  padding: 10,
  borderRadius: 8,
  border: '1px solid #d1d5db'
};

export default function UtilityDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const utilityId = typeof id === 'string' ? id : '';

  const [context, setContext] = useState<UtilityDataContext | null>(null);
  const [dataMode, setDataMode] = useState<UtilityDataMode>('demo');
  const [utility, setUtility] = useState<UtilityRow | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [repairs, setRepairs] = useState<RepairRow[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
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
        const [nextContext, reminderContext, repairContext, serviceRecordContext, nextDocumentContext, nextReceiptContext, issueContext, trendFlagContext] = await Promise.all([
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
          getServiceRecordsForUtility(serviceRecordContext, utilityId),
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
        setRooms(roomRows.map((room) => ({ id: room.id, name: room.name })));
        setReminders(nextReminders);
        setRepairs(nextRepairs);
        setServiceRecords(nextServiceRecords);
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

    load();

    return () => {
      isMounted = false;
    };
  }, [utilityId]);

  const roomName = utility?.room_id
    ? rooms.find((room) => room.id === utility.room_id)?.name || 'Unknown room'
    : 'Not assigned';

  const saveUtility = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!context || !utility) return;

    if (!name.trim()) {
      setFormError('Utility name is required.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const updatedUtility = await updateUtilityForContext(context, utility.id, {
        name,
        utility_type: utilityType,
        room_id: roomId || null,
        location_notes: locationNotes,
        emergency_notes: emergencyNotes
      });

      if (updatedUtility) {
        setUtility(updatedUtility);
      }
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to update utility.');
    } finally {
      setSaving(false);
    }
  };

  const deleteUtility = async () => {
    if (!context || !utility) return;

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
          <p style={{ margin: 0, color: '#6b7280' }}>Loading utility...</p>
        </Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Utility error" />
        <Card>
          <p style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</p>
          <Link href="/utilities">
            <Button type="button">Back to utilities</Button>
          </Link>
        </Card>
      </>
    );
  }

  if (!utility) {
    return (
      <>
        <PageHeader title="Utility not found" />
        <Card>
          <p style={{ color: '#6b7280' }}>
            This utility may have been removed, or it may not belong to the current property.
          </p>
          <Link href="/utilities">
            <Button type="button">Back to utilities</Button>
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={utility.name} description={formatEnumLabel(utility.utility_type)} />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? '#065f46' : '#6b7280' }}>
            {dataMode === 'supabase'
              ? 'Signed-in mode: this utility and related records are saved to your Supabase-backed account.'
              : 'Demo mode: this utility and related records are stored locally in this browser.'}
          </p>
          {formError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>{formError}</p>
          ) : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Utility snapshot</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <UtilityBadge label={formatEnumLabel(utility.utility_type)} />
            <UtilityBadge label={roomName} />
            <UtilityBadge label={`${reminders.length} reminder${reminders.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${repairs.length} repair${repairs.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${serviceRecords.length} service record${serviceRecords.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${documents.length} document${documents.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${receipts.length} receipt${receipts.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${issues.length} issue${issues.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${trendFlags.length} trend flag${trendFlags.length === 1 ? '' : 's'}`} />
          </div>
          {utility.location_notes ? <p><strong>Location:</strong> {utility.location_notes}</p> : null}
          {utility.emergency_notes ? <p style={{ color: '#b91c1c' }}><strong>Emergency:</strong> {utility.emergency_notes}</p> : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Edit utility</h2>
          <form onSubmit={saveUtility} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} style={fieldStyle} />
            </label>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Type</span>
                <select value={utilityType} onChange={(event) => setUtilityType(event.target.value as UtilityType)} style={fieldStyle}>
                  {UTILITY_TYPES.map((type) => (
                    <option key={type} value={type}>{formatEnumLabel(type)}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Room</span>
                <select value={roomId} onChange={(event) => setRoomId(event.target.value)} style={fieldStyle}>
                  <option value="">Not assigned</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
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
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  opacity: deleting ? 0.7 : 1
                }}
              >
                {deleting ? 'Deleting...' : 'Delete utility'}
              </button>
            </div>
          </form>
        </Card>

        <RelatedList title="Reminders" empty="No reminders linked to this utility.">
          {reminders.map((reminder) => (
            <RelatedItem key={reminder.id} title={reminder.title} detail={`${reminder.due_date || 'No due date'} • ${formatEnumLabel(reminder.status)}`} />
          ))}
        </RelatedList>

        <RelatedList title="Repairs" empty="No repairs linked to this utility.">
          {repairs.map((repair) => (
            <RelatedItem key={repair.id} title={repair.title} detail={`${repair.reported_date || 'No reported date'} • ${formatEnumLabel(repair.status)}`} href={`/repairs/${repair.id}`} />
          ))}
        </RelatedList>

        <RelatedList title="Service records" empty="No service records linked to this utility.">
          {serviceRecords.map((record) => (
            <RelatedItem key={record.id} title={record.service_title} detail={`${record.service_date} • ${formatEnumLabel(record.service_type)}`} />
          ))}
        </RelatedList>

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

        <RelatedList title="Issues" empty="No issues linked to this utility.">
          {issues.map((issue) => (
            <RelatedItem key={issue.id} title={issue.title} detail={`${formatEnumLabel(issue.status)} • ${formatEnumLabel(issue.severity)}`} href={`/issues/${issue.id}`} />
          ))}
        </RelatedList>

        <RelatedList title="Trend flags" empty="No trend flags linked to this utility.">
          {trendFlags.map((flag) => (
            <RelatedItem key={flag.id} title={flag.title} detail={`${formatEnumLabel(flag.status)} • ${formatEnumLabel(flag.severity)}`} />
          ))}
        </RelatedList>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/utilities">
            <Button type="button">Back to utilities</Button>
          </Link>
          <Link href="/dashboard">
            <Button type="button">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    </>
  );
}

function RelatedList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {hasItems ? <div style={{ display: 'grid', gap: 10 }}>{children}</div> : <p style={{ color: '#6b7280', margin: 0 }}>{empty}</p>}
    </Card>
  );
}

function RelatedItem({ title, detail, href }: { title: string; detail: string; href?: string }) {
  const content = (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>{detail}</div>
    </div>
  );

  return href ? (
    <Link href={href} style={{ color: 'inherit', textDecoration: 'none' }}>
      {content}
    </Link>
  ) : content;
}
