import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatEnumLabel, REPAIR_STATUSES } from '@home-bible/shared';
import { Button, Card, PageHeader, UtilityBadge } from '@home-bible/ui';
import { RelatedDocuments } from '../../components/RelatedDocuments';
import { getAssetsForProperty, getDemoAssets, type AssetRow } from '../../lib/assets';
import { getDemoRooms } from '../../lib/demoStorage';
import {
  getDocumentDataContext,
  getDocumentsForLink,
  type DocumentDataContext,
  type DocumentRow
} from '../../lib/documents';
import { getIssueDataContext, getIssuesForRepair, type IssueRow } from '../../lib/issues';
import { getReminderDataContext, getRemindersForContext, type ReminderRow } from '../../lib/reminders';
import {
  deleteRepairForContext,
  getRepairByIdForContext,
  getRepairDataContext,
  updateRepairStatusForContext,
  type RepairDataContext,
  type RepairDataMode,
  type RepairRow,
  type RepairStatus
} from '../../lib/repairs';
import { getRoomsForProperty } from '../../lib/rooms';
import { getServiceRecordDataContext, getServiceRecordsForContext, type ServiceRecordRow } from '../../lib/serviceRecords';
import { getTrendFlagDataContext, getTrendFlagsForContext, type TrendFlagRow } from '../../lib/trendFlags';
import { getDemoUtilities, getUtilitiesForProperty, type UtilityRow } from '../../lib/utilities';

type LinkOption = {
  id: string;
  name: string;
};

const fieldStyle = {
  padding: 10,
  borderRadius: 8,
  border: '1px solid #d1d5db'
};

function nameFromId(list: LinkOption[], id?: string | null) {
  if (!id) return null;
  return list.find((item) => item.id === id)?.name || 'Unknown';
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

  const [context, setContext] = useState<RepairDataContext | null>(null);
  const [dataMode, setDataMode] = useState<RepairDataMode>('demo');
  const [repair, setRepair] = useState<RepairRow | null>(null);
  const [rooms, setRooms] = useState<LinkOption[]>([]);
  const [assets, setAssets] = useState<LinkOption[]>([]);
  const [utilities, setUtilities] = useState<LinkOption[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
  const [documentContext, setDocumentContext] = useState<DocumentDataContext | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [trendFlags, setTrendFlags] = useState<TrendFlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!repairId) return;

      setLoading(true);
      setError('');

      try {
        const [nextContext, serviceContext, documentContextForLoad, reminderContext, issueContext, trendFlagContext] = await Promise.all([
          getRepairDataContext(),
          getServiceRecordDataContext(),
          getDocumentDataContext(),
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

        const [allServiceRecords, repairDocuments, allReminders, repairIssues, allTrendFlags] = await Promise.all([
          getServiceRecordsForContext(serviceContext),
          getDocumentsForLink(documentContextForLoad, { field: 'repair_id', id: repairId }),
          getRemindersForContext(reminderContext),
          getIssuesForRepair(issueContext, repairId),
          getTrendFlagsForContext(trendFlagContext)
        ]);

        if (!isMounted) return;

        setContext(nextContext);
        setDataMode(nextContext.mode);
        setRepair(nextRepair);
        setRooms(roomRows.map((room) => ({ id: room.id, name: room.name })));
        setAssets(assetRows.map((asset: AssetRow) => ({ id: asset.id, name: asset.name })));
        setUtilities(utilityRows.map((utility: UtilityRow) => ({ id: utility.id, name: utility.name })));
        setDocumentContext(documentContextForLoad);
        setDocuments(repairDocuments);
        setIssues(repairIssues);

        if (nextRepair) {
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

    load();

    return () => {
      isMounted = false;
    };
  }, [repairId]);

  const statusOptions = useMemo(() => REPAIR_STATUSES, []);

  const changeStatus = async (status: RepairStatus) => {
    if (!context || !repair) return;

    setActing(true);
    setError('');

    try {
      const updatedRepair = await updateRepairStatusForContext(context, repair.id, status);
      if (updatedRepair) setRepair(updatedRepair);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update repair status.');
    } finally {
      setActing(false);
    }
  };

  const deleteRepair = async () => {
    if (!context || !repair) return;

    setActing(true);
    setError('');

    try {
      await deleteRepairForContext(context, repair.id);
      router.push('/repairs');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete repair.');
      setActing(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Repair" />
        <Card>
          <p style={{ color: '#6b7280', margin: 0 }}>Loading repair...</p>
        </Card>
      </>
    );
  }

  if (!repair) {
    return (
      <>
        <PageHeader title={error ? 'Repair error' : 'Repair not found'} />
        <Card>
          <p style={{ color: error ? '#b91c1c' : '#6b7280', fontWeight: error ? 700 : 400 }}>
            {error || 'This repair may have been removed, or it may not belong to the current property.'}
          </p>
          <Link href="/repairs">
            <Button type="button">Back to repairs</Button>
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={repair.title} description={formatEnumLabel(repair.repair_type)} />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? '#065f46' : '#6b7280' }}>
            {dataMode === 'supabase'
              ? 'Signed-in mode: this repair and related records are saved to your Supabase-backed account.'
              : 'Demo mode: this repair and related records are stored locally in this browser.'}
          </p>
          {error ? <p style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</p> : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Repair snapshot</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <UtilityBadge label={formatEnumLabel(repair.status)} />
            <UtilityBadge label={formatEnumLabel(repair.priority)} />
            {repair.room_id && <UtilityBadge label={`Room: ${nameFromId(rooms, repair.room_id) || 'Unknown'}`} />}
            {repair.asset_id && <UtilityBadge label={`Asset: ${nameFromId(assets, repair.asset_id) || 'Unknown'}`} />}
            {repair.utility_id && <UtilityBadge label={`Utility: ${nameFromId(utilities, repair.utility_id) || 'Unknown'}`} />}
            <UtilityBadge label={`${documents.length} document${documents.length === 1 ? '' : 's'}`} />
          </div>
          <div style={{ color: '#4b5563', display: 'grid', gap: 6 }}>
            <div><strong>Reported:</strong> {repair.reported_date || 'Not set'}</div>
            {repair.completed_date && <div><strong>Completed:</strong> {repair.completed_date}</div>}
            {repair.contractor_name && <div><strong>Contractor:</strong> {repair.contractor_name}</div>}
            {repair.estimated_cost !== null && <div><strong>Estimated:</strong> ${repair.estimated_cost}</div>}
            {repair.actual_cost !== null && <div><strong>Actual:</strong> ${repair.actual_cost}</div>}
            {repair.description && <div><strong>Description:</strong> {repair.description}</div>}
            {repair.notes && <div><strong>Notes:</strong> {repair.notes}</div>}
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Status</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={repair.status} onChange={(event) => changeStatus(event.target.value as RepairStatus)} disabled={acting} style={fieldStyle}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{formatEnumLabel(status)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={deleteRepair}
              disabled={acting}
              style={{
                padding: '10px 14px',
                borderRadius: 6,
                border: '1px solid #fecaca',
                background: '#fef2f2',
                color: '#b91c1c',
                cursor: acting ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                opacity: acting ? 0.7 : 1
              }}
            >
              Delete repair
            </button>
          </div>
        </Card>

        <RelatedList title="Service records" empty="No related service records found.">
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

        <RelatedList title="Trend flags" empty="No related trend flags found.">
          {trendFlags.map((flag) => (
            <RelatedItem key={flag.id} title={flag.title} detail={`${formatEnumLabel(flag.status)} • ${formatEnumLabel(flag.severity)}`} />
          ))}
        </RelatedList>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/repairs">
            <Button type="button">Back to repairs</Button>
          </Link>
          <Link href="/dashboard">
            <Button type="button">Back to dashboard</Button>
          </Link>
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
