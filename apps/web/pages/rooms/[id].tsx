import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Button, UtilityBadge } from '@home-bible/ui';
import { RelatedDocuments } from '../../components/RelatedDocuments';
import { RelatedReceipts } from '../../components/RelatedReceipts';
import { getAssetDataContext, getAssetsForRoom, type AssetRow } from '../../lib/assets';
import { getDemoRooms } from '../../lib/demoStorage';
import {
  getDocumentDataContext,
  getDocumentsForLink,
  type DocumentDataContext,
  type DocumentRow
} from '../../lib/documents';
import { getIssueDataContext, getIssuesForContext, type IssueRow } from '../../lib/issues';
import { getReminderDataContext, getRemindersForRoom, type ReminderRow } from '../../lib/reminders';
import { getReceiptDataContext, getReceiptsForLink, type ReceiptDataContext, type ReceiptRow } from '../../lib/receipts';
import { getRepairDataContext, getRepairsForContext, type RepairRow } from '../../lib/repairs';
import { getRoomById } from '../../lib/rooms';
import { getServiceRecordDataContext, getServiceRecordsForContext, type ServiceRecordRow } from '../../lib/serviceRecords';
import { getTrendFlagDataContext, getTrendFlagsForContext, type TrendFlagRow } from '../../lib/trendFlags';
import { getUtilitiesForRoom, getUtilityDataContext, type UtilityRow } from '../../lib/utilities';

type Room = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
};

export default function RoomDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const roomId = typeof id === 'string' ? id : '';

  const [dataMode, setDataMode] = useState<'demo' | 'supabase'>('demo');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [utilities, setUtilities] = useState<UtilityRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [repairs, setRepairs] = useState<RepairRow[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
  const [documentContext, setDocumentContext] = useState<DocumentDataContext | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [receiptContext, setReceiptContext] = useState<ReceiptDataContext | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [trendFlags, setTrendFlags] = useState<TrendFlagRow[]>([]);
  const [utilityError, setUtilityError] = useState('');
  const [assetError, setAssetError] = useState('');
  const [reminderError, setReminderError] = useState('');
  const [repairError, setRepairError] = useState('');
  const [serviceRecordError, setServiceRecordError] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [receiptError, setReceiptError] = useState('');
  const [issueError, setIssueError] = useState('');
  const [trendFlagError, setTrendFlagError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!roomId) {
        return;
      }

      setUtilityError('');
      setAssetError('');
      setReminderError('');
      setRepairError('');
      setServiceRecordError('');
      setDocumentError('');
      setReceiptError('');
      setIssueError('');
      setTrendFlagError('');

      const [
        utilityContext,
        assetContext,
        reminderContext,
        repairContext,
        serviceRecordContext,
        nextDocumentContext,
        nextReceiptContext,
        issueContext,
        trendFlagContext
      ] = await Promise.all([
        getUtilityDataContext(),
        getAssetDataContext(),
        getReminderDataContext(),
        getRepairDataContext(),
        getServiceRecordDataContext(),
        getDocumentDataContext(),
        getReceiptDataContext(),
        getIssueDataContext(),
        getTrendFlagDataContext()
      ]);
      let nextUtilities: UtilityRow[] = [];
      let nextAssets: AssetRow[] = [];
      let nextReminders: ReminderRow[] = [];
      let nextRepairs: RepairRow[] = [];
      let nextServiceRecords: ServiceRecordRow[] = [];
      let nextDocuments: DocumentRow[] = [];
      let nextReceipts: ReceiptRow[] = [];
      let nextIssues: IssueRow[] = [];
      let nextTrendFlags: TrendFlagRow[] = [];

      try {
        nextUtilities = await getUtilitiesForRoom(utilityContext, roomId);
      } catch (loadError) {
        if (isMounted) {
          setUtilityError(loadError instanceof Error ? loadError.message : 'Failed to load room utilities.');
        }
      }

      try {
        nextAssets = await getAssetsForRoom(assetContext, roomId);
      } catch (loadError) {
        if (isMounted) {
          setAssetError(loadError instanceof Error ? loadError.message : 'Failed to load room assets.');
        }
      }

      try {
        nextReminders = await getRemindersForRoom(reminderContext, roomId);
      } catch (loadError) {
        if (isMounted) {
          setReminderError(loadError instanceof Error ? loadError.message : 'Failed to load room reminders.');
        }
      }

      try {
        nextRepairs = await getRepairsForContext(repairContext);
      } catch (loadError) {
        if (isMounted) {
          setRepairError(loadError instanceof Error ? loadError.message : 'Failed to load room repairs.');
        }
      }

      try {
        nextServiceRecords = await getServiceRecordsForContext(serviceRecordContext);
      } catch (loadError) {
        if (isMounted) {
          setServiceRecordError(loadError instanceof Error ? loadError.message : 'Failed to load room service history.');
        }
      }

      try {
        nextDocuments = await getDocumentsForLink(nextDocumentContext, { field: 'room_id', id: roomId });
      } catch (loadError) {
        if (isMounted) {
          setDocumentError(loadError instanceof Error ? loadError.message : 'Failed to load room documents.');
        }
      }

      try {
        nextReceipts = await getReceiptsForLink(nextReceiptContext, { field: 'room_id', id: roomId });
      } catch (loadError) {
        if (isMounted) {
          setReceiptError(loadError instanceof Error ? loadError.message : 'Failed to load room receipts.');
        }
      }

      try {
        nextIssues = await getIssuesForContext(issueContext);
      } catch (loadError) {
        if (isMounted) {
          setIssueError(loadError instanceof Error ? loadError.message : 'Failed to load room issues.');
        }
      }

      try {
        nextTrendFlags = await getTrendFlagsForContext(trendFlagContext);
      } catch (loadError) {
        if (isMounted) {
          setTrendFlagError(loadError instanceof Error ? loadError.message : 'Failed to load room trends.');
        }
      }

      if (utilityContext.mode === 'supabase') {
        const remoteRoom = await getRoomById(roomId);

        if (!isMounted) {
          return;
        }

        if (remoteRoom) {
          setDataMode('supabase');
          setRooms([
            {
              id: remoteRoom.id,
              name: remoteRoom.name,
              room_type: remoteRoom.room_type,
              floor_name: remoteRoom.floor_name
            }
          ]);
        } else {
          setDataMode('supabase');
          setRooms([]);
        }
      } else {
        if (!isMounted) {
          return;
        }
        setDataMode('demo');
        setRooms(getDemoRooms());
      }

      setUtilities(nextUtilities);
      setAssets(nextAssets);
      setReminders(nextReminders);
      setRepairs(nextRepairs);
      setServiceRecords(nextServiceRecords);
      setDocumentContext(nextDocumentContext);
      setDocuments(nextDocuments);
      setReceiptContext(nextReceiptContext);
      setReceipts(nextReceipts);
      setIssues(nextIssues);
      setTrendFlags(nextTrendFlags);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [roomId]);

  const room = useMemo(() => {
    return rooms.find((currentRoom) => currentRoom.id === roomId);
  }, [rooms, roomId]);

  const roomUtilities = useMemo(() => {
    return utilities.filter((u) => u.room_id === roomId);
  }, [utilities, roomId]);

  const roomAssets = useMemo(() => {
    return assets.filter((a) => a.room_id === roomId);
  }, [assets, roomId]);

  const roomReminders = useMemo(
    () =>
      reminders.filter(
        (reminder) =>
          reminder.room_id === roomId ||
          (reminder.linked_type === 'room' && reminder.linked_id === roomId)
      ),
    [reminders, roomId]
  );

  const utilityIdsInRoom = useMemo(
    () => new Set(roomUtilities.map((utility) => utility.id)),
    [roomUtilities]
  );

  const roomServiceRecords = useMemo(
    () =>
      serviceRecords.filter(
        (record) => record.room_id === roomId || (!!record.utility_id && utilityIdsInRoom.has(record.utility_id))
      ),
    [serviceRecords, roomId, utilityIdsInRoom]
  );

  const roomRepairs = useMemo(
    () =>
      repairs.filter(
        (repair) => repair.room_id === roomId || (!!repair.utility_id && utilityIdsInRoom.has(repair.utility_id))
      ),
    [repairs, roomId, utilityIdsInRoom]
  );

  const roomIssues = useMemo(
    () =>
      issues.filter(
        (issue) => issue.room_id === roomId || (!!issue.utility_id && utilityIdsInRoom.has(issue.utility_id))
      ),
    [issues, roomId, utilityIdsInRoom]
  );

  const roomTrendFlags = useMemo(
    () =>
      trendFlags.filter(
        (flag) => flag.room_id === roomId || (!!flag.utility_id && utilityIdsInRoom.has(flag.utility_id))
      ),
    [trendFlags, roomId, utilityIdsInRoom]
  );

  if (!room) {
    return (
      <>
        <PageHeader title="Room not found" />
        <Card>
          <p style={{ color: '#6b7280' }}>
            This room may not exist yet, or setup data was cleared.
          </p>
          <p style={{ color: '#6b7280', marginTop: 8 }}>
            {dataMode === 'supabase'
              ? 'Saved to your account. If this room was removed, it will no longer appear.'
              : 'Demo data is stored only in this browser. Add rooms from the onboarding flow to continue.'}
          </p>
          <Link href="/home-map">
            <Button type="button">Back to home map</Button>
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={room.name}
        description={`${formatEnumLabel(room.room_type)} on ${room.floor_name}`}
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>Room snapshot</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <UtilityBadge label={formatEnumLabel(room.room_type)} />
            <UtilityBadge label={room.floor_name} />
            <UtilityBadge label={`${roomUtilities.length} utilit${roomUtilities.length === 1 ? 'y' : 'ies'}`} />
            <UtilityBadge label={`${roomAssets.length} asset${roomAssets.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${roomReminders.length} reminder${roomReminders.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${roomRepairs.length} repair${roomRepairs.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${roomServiceRecords.length} service history item${roomServiceRecords.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${documents.length} document${documents.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${receipts.length} receipt${receipts.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${roomIssues.length} issue${roomIssues.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${roomTrendFlags.length} trend${roomTrendFlags.length === 1 ? '' : 's'}`} />
          </div>
          <p style={{ marginTop: 12, marginBottom: 0, color: '#6b7280' }}>
            {dataMode === 'supabase'
              ? 'Saved to your account.'
              : 'Demo data is stored only in this browser.'}
          </p>
          {utilityError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {utilityError}
            </p>
          ) : null}
          {assetError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {assetError}
            </p>
          ) : null}
          {reminderError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {reminderError}
            </p>
          ) : null}
          {repairError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {repairError}
            </p>
          ) : null}
          {serviceRecordError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {serviceRecordError}
            </p>
          ) : null}
          {documentError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {documentError}
            </p>
          ) : null}
          {receiptError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {receiptError}
            </p>
          ) : null}
          {issueError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {issueError}
            </p>
          ) : null}
          {trendFlagError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {trendFlagError}
            </p>
          ) : null}
        </Card>

        <RelatedDocuments
          documents={documents}
          context={documentContext}
          uploadHref={`/documents?roomId=${roomId}`}
          empty="No documents linked to this room."
        />

        <RelatedReceipts
          receipts={receipts}
          context={receiptContext}
          uploadHref={`/receipts?roomId=${roomId}`}
          empty="No receipts linked to this room."
        />

        <Card>
          <h2 style={{ marginTop: 0 }}>Trend flags</h2>
          {roomTrendFlags.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No room-level trends currently.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {roomTrendFlags.map((flag) => (
                <div key={flag.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontWeight: 600 }}>{flag.title}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    {formatEnumLabel(flag.flag_type)} • {formatEnumLabel(flag.status)} • {formatEnumLabel(flag.severity)}
                  </div>
                  {flag.description ? (
                    <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 4 }}>{flag.description}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        {roomUtilities.length > 0 && (
          <Card>
            <h2 style={{ marginTop: 0 }}>Utilities in this room</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {roomUtilities.map((utility) => (
                <div
                  key={utility.id}
                  style={{
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{utility.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 4 }}>
                    <UtilityBadge label={formatEnumLabel(utility.utility_type)} />
                  </div>
                  {utility.location_notes && (
                    <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                      <strong>Location:</strong> {utility.location_notes}
                    </div>
                  )}
                  {utility.emergency_notes && (
                    <div style={{ fontSize: '0.875rem', color: '#dc2626' }}>
                      <strong>Emergency:</strong> {utility.emergency_notes}
                    </div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <Link href={`/utilities/${utility.id}`}>
                      <Button type="button">View utility</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {roomAssets.length > 0 && (
          <Card>
            <h2 style={{ marginTop: 0 }}>Assets in this room</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {roomAssets.map((asset) => (
                <div
                  key={asset.id}
                  style={{
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{asset.name}</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 4 }}>
                        <UtilityBadge label={formatEnumLabel(asset.asset_type)} />
                      </div>
                      {asset.brand && (
                        <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                          <strong>Brand:</strong> {asset.brand}
                        </div>
                      )}
                      {asset.model && (
                        <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                          <strong>Model:</strong> {asset.model}
                        </div>
                      )}
                      {asset.warranty_expires_at && (
                        <div style={{ fontSize: '0.875rem', color: '#d97706', marginBottom: 4 }}>
                          <strong>Warranty expires:</strong> {asset.warranty_expires_at}
                        </div>
                      )}
                    </div>
                    <Link href={`/assets/${asset.id}`}>
                      <Button type="button">View</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <h2 style={{ marginTop: 0 }}>Repairs for this room</h2>
          {roomRepairs.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No repairs linked to this room.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {roomRepairs
                .slice()
                .sort((a, b) => new Date(b.reported_date || b.created_at).getTime() - new Date(a.reported_date || a.created_at).getTime())
                .map((repair) => (
                  <div key={repair.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{repair.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {repair.reported_date || 'No reported date'} • {formatEnumLabel(repair.repair_type)} • {formatEnumLabel(repair.status)}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <Link href={`/repairs/${repair.id}`}>
                        <Button type="button">View repair</Button>
                      </Link>
                    </div>
                  </div>
                ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/repairs">
              <Button type="button">Manage repairs</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Service records for this room</h2>
          {roomServiceRecords.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No service history linked to this room.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {roomServiceRecords
                .slice()
                .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime())
                .map((record) => (
                  <div key={record.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{record.service_title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {record.service_date} • {formatEnumLabel(record.service_type)}
                    </div>
                    {record.next_service_date && (
                      <div style={{ color: '#92400e', fontSize: '0.875rem' }}>
                        Next service: {record.next_service_date}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/repairs">
              <Button type="button">Manage repairs</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Issues for this room</h2>
          {roomIssues.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No issues linked to this room.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {roomIssues
                .slice()
                .sort((a, b) => new Date(b.first_seen_date || b.created_at).getTime() - new Date(a.first_seen_date || a.created_at).getTime())
                .map((issue) => (
                  <div key={issue.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{issue.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {issue.first_seen_date || 'Not set'} • {formatEnumLabel(issue.issue_type)} • {formatEnumLabel(issue.status)}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <Link href={`/issues/${issue.id}`}>
                        <Button type="button">View issue</Button>
                      </Link>
                    </div>
                  </div>
                ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/issues">
              <Button type="button">Manage issues</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Reminders for this room</h2>
          {roomReminders.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No reminders linked to this room yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {roomReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  style={{
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{reminder.title}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    {reminder.due_date || 'No due date'} • {formatEnumLabel(reminder.status)} •{' '}
                    {formatEnumLabel(reminder.reminder_type)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/reminders">
              <Button type="button">Manage reminders</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>What will live here</h2>
          <p style={{ color: '#4b5563' }}>
            This room will store utilities, appliances, accessories, smart devices, tools, receipts, warranties, repairs, photos, and notes.
          </p>
        </Card>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/home-map">
            <Button type="button">Back to home map</Button>
          </Link>
          <Link href="/dashboard">
            <Button type="button">Back to dashboard</Button>
          </Link>
          <Link href="/utilities">
            <Button type="button">All utilities</Button>
          </Link>
          <Link href="/repairs">
            <Button type="button">All repairs</Button>
          </Link>
          <Link href="/issues">
            <Button type="button">All issues</Button>
          </Link>
          <Link href="/reminders">
            <Button type="button">All reminders</Button>
          </Link>
          <Link href="/settings">
            <Button type="button">Settings</Button>
          </Link>
        </div>
      </div>
    </>
  );
}
