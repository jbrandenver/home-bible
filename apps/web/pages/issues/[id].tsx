import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, type ReactNode } from 'react';
import { formatEnumLabel, ISSUE_STATUSES } from '@home-bible/shared';
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
import {
  deleteIssueForContext,
  getIssueByIdForContext,
  getIssueDataContext,
  updateIssueStatusForContext,
  type IssueDataContext,
  type IssueDataMode,
  type IssueRow,
  type IssueStatus
} from '../../lib/issues';
import { getReminderDataContext, getRemindersForContext, type ReminderRow } from '../../lib/reminders';
import { getDemoRepairs, getRepairsForProperty, type RepairRow } from '../../lib/repairs';
import { getRoomsForProperty } from '../../lib/rooms';
import { getTrendFlagDataContext, getTrendFlagsForIssue, type TrendFlagRow } from '../../lib/trendFlags';
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
  const [rooms, setRooms] = useState<LinkOption[]>([]);
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
        setRooms(roomRows.map((room) => ({ id: room.id, name: room.name })));
        setAssets(assetRows.map((asset: AssetRow) => ({ id: asset.id, name: asset.name })));
        setUtilities(utilityRows.map((utility: UtilityRow) => ({ id: utility.id, name: utility.name })));
        setRepairs(repairRows.map((repair: RepairRow) => ({ id: repair.id, name: repair.title })));
        setDocumentContext(documentContextForLoad);
        setDocuments(issueDocuments);
        setTrendFlags(issueTrendFlags);
        setReminders(nextIssue ? allReminders.filter((reminder) => reminderRelatesToIssue(nextIssue, reminder)) : []);
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

    load();

    return () => {
      isMounted = false;
    };
  }, [issueId]);

  const changeStatus = async (status: IssueStatus) => {
    if (!context || !issue) return;

    setActing(true);
    setError('');

    try {
      const updatedIssue = await updateIssueStatusForContext(context, issue.id, status);
      if (updatedIssue) setIssue(updatedIssue);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update issue status.');
    } finally {
      setActing(false);
    }
  };

  const deleteIssue = async () => {
    if (!context || !issue) return;

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
          <p style={{ color: '#6b7280', margin: 0 }}>Loading issue...</p>
        </Card>
      </>
    );
  }

  if (!issue) {
    return (
      <>
        <PageHeader title={error ? 'Issue error' : 'Issue not found'} />
        <Card>
          <p style={{ color: error ? '#b91c1c' : '#6b7280', fontWeight: error ? 700 : 400 }}>
            {error || 'This issue may have been removed, or it may not belong to the current property.'}
          </p>
          <Link href="/issues">
            <Button type="button">Back to issues</Button>
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={issue.title} description={formatEnumLabel(issue.issue_type)} />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? '#065f46' : '#6b7280' }}>
            {dataMode === 'supabase'
              ? 'Signed-in mode: this issue and related records are saved to your Supabase-backed account.'
              : 'Demo mode: this issue and related records are stored locally in this browser.'}
          </p>
          {error ? <p style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</p> : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Issue snapshot</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <UtilityBadge label={formatEnumLabel(issue.status)} />
            <UtilityBadge label={formatEnumLabel(issue.severity)} />
            {issue.room_id && <UtilityBadge label={`Room: ${nameFromId(rooms, issue.room_id) || 'Unknown'}`} />}
            {issue.asset_id && <UtilityBadge label={`Asset: ${nameFromId(assets, issue.asset_id) || 'Unknown'}`} />}
            {issue.utility_id && <UtilityBadge label={`Utility: ${nameFromId(utilities, issue.utility_id) || 'Unknown'}`} />}
            {issue.repair_id && <UtilityBadge label={`Repair: ${nameFromId(repairs, issue.repair_id) || 'Unknown'}`} />}
            <UtilityBadge label={`${documents.length} document${documents.length === 1 ? '' : 's'}`} />
          </div>
          <div style={{ color: '#4b5563', display: 'grid', gap: 6 }}>
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
                border: '1px solid #fecaca',
                background: '#fef2f2',
                color: '#b91c1c',
                cursor: acting ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                opacity: acting ? 0.7 : 1
              }}
            >
              Delete issue
            </button>
          </div>
        </Card>

        {issue.repair_id ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Linked repair</h2>
            <Link href={`/repairs/${issue.repair_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 700 }}>{nameFromId(repairs, issue.repair_id) || 'Repair'}</div>
                <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Open repair detail</div>
              </div>
            </Link>
          </Card>
        ) : null}

        <RelatedList title="Trend flags" empty="No trend flags linked to this issue.">
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
          <Link href="/issues">
            <Button type="button">Back to issues</Button>
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

function RelatedItem({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>{detail}</div>
    </div>
  );
}
