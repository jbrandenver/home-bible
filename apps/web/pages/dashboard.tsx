import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, UtilityBadge } from '@home-bible/ui';
import { ActionLink } from '../components/ActionLink';
import { getAssetDataContext, getAssetsForContext, type AssetRow } from '../lib/assets';
import { getDemoActiveProperty, getDemoRooms } from '../lib/demoStorage';
import { getDocumentDataContext, getDocumentsForContext, type DocumentRow } from '../lib/documents';
import { getIssueDataContext, getIssuesForContext, type IssueRow } from '../lib/issues';
import { getReminderDataContext, getRemindersForContext, type ReminderRow } from '../lib/reminders';
import { formatReceiptAmount, getReceiptDataContext, getReceiptsForContext, type ReceiptRow } from '../lib/receipts';
import { getRepairDataContext, getRepairsForContext, type RepairRow } from '../lib/repairs';
import { getFloorsForProperty, getRoomsForProperty } from '../lib/rooms';
import { formatRoomLocation, formatRoomTypeLabel, getRoomSpaceSummary } from '../lib/roomLabels';
import { getServiceRecordDataContext, getServiceRecordsForContext, type ServiceRecordRow } from '../lib/serviceRecords';
import { getTrendFlagDataContext, getTrendFlagsForContext, type TrendFlagRow } from '../lib/trendFlags';
import { getUtilitiesForContext, getUtilityDataContext, type UtilityRow } from '../lib/utilities';

type Room = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
};

function getWarrantyStatus(asset: AssetRow): 'active' | 'expiring_soon' | 'expired' | 'unknown' {
  let expirationDate: Date | null = null;

  if (asset.warranty_expires_at) {
    expirationDate = new Date(asset.warranty_expires_at);
  } else if (asset.purchase_date && asset.warranty_length_months) {
    const purchaseDate = new Date(asset.purchase_date);
    expirationDate = new Date(purchaseDate);
    expirationDate.setMonth(expirationDate.getMonth() + asset.warranty_length_months);
  }

  if (!expirationDate || Number.isNaN(expirationDate.getTime())) {
    return 'unknown';
  }

  const daysRemaining = Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return 'expired';
  }

  if (daysRemaining <= 30) {
    return 'expiring_soon';
  }

  return 'active';
};

export default function DashboardPage() {
  const [propertyNickname, setPropertyNickname] = useState('Your property');
  const [dataMode, setDataMode] = useState<'demo' | 'supabase'>('demo');
  const [hasProperty, setHasProperty] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [utilities, setUtilities] = useState<UtilityRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [repairs, setRepairs] = useState<RepairRow[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [trendFlags, setTrendFlags] = useState<TrendFlagRow[]>([]);
  const [floorCount, setFloorCount] = useState(0);
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
        documentContext,
        receiptContext,
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
        nextUtilities = await getUtilitiesForContext(utilityContext);
      } catch (loadError) {
        if (isMounted) {
          setUtilityError(loadError instanceof Error ? loadError.message : 'Failed to load utilities.');
        }
      }

      try {
        nextAssets = await getAssetsForContext(assetContext);
      } catch (loadError) {
        if (isMounted) {
          setAssetError(loadError instanceof Error ? loadError.message : 'Failed to load assets.');
        }
      }

      try {
        nextReminders = await getRemindersForContext(reminderContext);
      } catch (loadError) {
        if (isMounted) {
          setReminderError(loadError instanceof Error ? loadError.message : 'Failed to load reminders.');
        }
      }

      try {
        nextRepairs = await getRepairsForContext(repairContext);
      } catch (loadError) {
        if (isMounted) {
          setRepairError(loadError instanceof Error ? loadError.message : 'Failed to load repairs.');
        }
      }

      try {
        nextServiceRecords = await getServiceRecordsForContext(serviceRecordContext);
      } catch (loadError) {
        if (isMounted) {
          setServiceRecordError(loadError instanceof Error ? loadError.message : 'Failed to load service history.');
        }
      }

      try {
        nextDocuments = await getDocumentsForContext(documentContext);
      } catch (loadError) {
        if (isMounted) {
          setDocumentError(loadError instanceof Error ? loadError.message : 'Failed to load documents.');
        }
      }

      try {
        nextReceipts = await getReceiptsForContext(receiptContext);
      } catch (loadError) {
        if (isMounted) {
          setReceiptError(loadError instanceof Error ? loadError.message : 'Failed to load receipts.');
        }
      }

      try {
        nextIssues = await getIssuesForContext(issueContext);
      } catch (loadError) {
        if (isMounted) {
          setIssueError(loadError instanceof Error ? loadError.message : 'Failed to load issues.');
        }
      }

      try {
        nextTrendFlags = await getTrendFlagsForContext(trendFlagContext);
      } catch (loadError) {
        if (isMounted) {
          setTrendFlagError(loadError instanceof Error ? loadError.message : 'Failed to load trends.');
        }
      }

      if (!isMounted) {
        return;
      }

      setDataMode(utilityContext.mode);
      setUtilities(nextUtilities);
      setAssets(nextAssets);
      setReminders(nextReminders);
      setRepairs(nextRepairs);
      setServiceRecords(nextServiceRecords);
      setDocuments(nextDocuments);
      setReceipts(nextReceipts);
      setIssues(nextIssues);
      setTrendFlags(nextTrendFlags);

      if (utilityContext.mode === 'supabase') {
        setHasProperty(Boolean(utilityContext.property));
        setPropertyNickname(utilityContext.property?.nickname || 'Your property');

        if (utilityContext.property) {
          const [floors, remoteRooms] = await Promise.all([
            getFloorsForProperty(utilityContext.property.id),
            getRoomsForProperty(utilityContext.property.id)
          ]);

          if (!isMounted) {
            return;
          }

          setFloorCount(floors.length);
          setRooms(
            remoteRooms.map((room) => ({
              id: room.id,
              name: room.name,
              room_type: room.room_type,
              floor_name: room.floor_name
            }))
          );
        } else {
          setFloorCount(0);
          setRooms([]);
        }
      } else {
        const demoProperty = getDemoActiveProperty();
        const demoRooms = getDemoRooms();

        setDataMode('demo');
        setHasProperty(Boolean(demoProperty));
        setPropertyNickname(demoProperty?.nickname || 'Your property');
        setRooms(demoRooms);
        setFloorCount(Array.from(new Set(demoRooms.map((room) => room.floor_name))).length);
      }

    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const floors = floorCount || Array.from(new Set(rooms.map((room) => room.floor_name))).length;
  const roomSpaceSummary = useMemo(() => getRoomSpaceSummary(rooms), [rooms]);

  const topAssetCategories = useMemo(() => {
    const counts = assets.reduce<Record<string, number>>((acc, asset) => {
      acc[asset.asset_type] = (acc[asset.asset_type] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [assets]);

  const warrantySummary = useMemo(
    () => ({
      active: assets.filter((asset) => getWarrantyStatus(asset) === 'active').length,
      expiringSoon: assets.filter((asset) => getWarrantyStatus(asset) === 'expiring_soon').length,
      expired: assets.filter((asset) => getWarrantyStatus(asset) === 'expired').length,
      unknown: assets.filter((asset) => getWarrantyStatus(asset) === 'unknown').length
    }),
    [assets]
  );

  const reminderSummary = useMemo(
    () => ({
      open: reminders.filter((reminder) => reminder.status === 'open').length,
      completed: reminders.filter((reminder) => reminder.status === 'completed').length,
      dismissed: reminders.filter((reminder) => reminder.status === 'dismissed').length
    }),
    [reminders]
  );

  const upcomingReminders = useMemo(
    () =>
      reminders
        .filter((reminder) => reminder.status === 'open')
        .slice()
        .sort((a, b) => {
          const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
          const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
          return aDue - bDue;
        })
        .slice(0, 4),
    [reminders]
  );

  const recentServiceRecords = useMemo(
    () =>
      serviceRecords
        .slice()
        .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime())
        .slice(0, 4),
    [serviceRecords]
  );

  const recentDocuments = useMemo(
    () =>
      documents
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 4),
    [documents]
  );

  const recentReceipts = useMemo(
    () =>
      receipts
        .slice()
        .sort((a, b) => {
          const aDate = a.purchase_date || a.created_at;
          const bDate = b.purchase_date || b.created_at;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        })
        .slice(0, 4),
    [receipts]
  );

  const openIssueCount = useMemo(
    () => issues.filter((issue) => issue.status !== 'resolved' && issue.status !== 'dismissed').length,
    [issues]
  );

  const highUrgentIssueCount = useMemo(
    () =>
      issues.filter(
        (issue) =>
          (issue.severity === 'high' || issue.severity === 'urgent') &&
          issue.status !== 'resolved' &&
          issue.status !== 'dismissed'
      ).length,
    [issues]
  );

  const activeTrendFlagCount = useMemo(
    () => trendFlags.filter((flag) => flag.status === 'active').length,
    [trendFlags]
  );

  const criticalUtilities = useMemo(() => {
    const criticalTypes = new Set([
      'main_water_shutoff',
      'electrical_panel',
      'gas_shutoff',
      'water_heater',
      'hvac_unit',
      'furnace',
      'air_conditioner',
      'breaker_panel',
      'sump_pump',
      'internet_modem',
      'router'
    ]);

    return utilities.filter((utility) => criticalTypes.has(utility.utility_type)).slice(0, 6);
  }, [utilities]);

  const openRepairCount = useMemo(
    () => repairs.filter((repair) => repair.status === 'open').length,
    [repairs]
  );

  const nextStep = useMemo(() => {
    if (!hasProperty) {
      return {
        title: 'Start your home record.',
        description: 'Create the property first. Then map rooms, utilities, assets, maintenance records, and files.',
        href: '/create-property',
        action: 'Create property'
      };
    }

    if (rooms.length === 0) {
      return {
        title: 'No rooms yet — let’s map the house.',
        description: 'Rooms and spaces are the foundation for utilities, assets, receipts, warranties, repairs, and documents.',
        href: '/add-rooms',
        action: 'Add rooms & spaces'
      };
    }

    if (utilities.length === 0) {
      return {
        title: 'Add the shut-offs and systems you’ll want to find fast.',
        description: 'Start with water, electrical, gas, HVAC, router, and safety devices.',
        href: '/utilities',
        action: 'Add utility'
      };
    }

    if (assets.length === 0) {
      return {
        title: 'Add the appliances, tools, and systems that belong to this home.',
        description: 'Assets connect purchases, warranties, reminders, repairs, and documents.',
        href: '/assets',
        action: 'Add asset'
      };
    }

    if (reminders.length === 0) {
      return {
        title: 'Add the care tasks you do again and again.',
        description: 'Use reminders for filters, seasonal work, inspections, and recurring upkeep.',
        href: '/reminders',
        action: 'Add reminder'
      };
    }

    if (documents.length === 0) {
      return {
        title: 'Keep manuals, warranties, reports, and files in one place.',
        description: 'Documents stay private and can be linked to rooms, utilities, assets, repairs, and issues.',
        href: '/documents',
        action: 'Upload document'
      };
    }

    return {
      title: 'Ready for a fuller review.',
      description: 'Build a handover later from the rooms, utilities, assets, records, and files you have saved.',
      href: '/handover',
      action: 'Build handover'
    };
  }, [assets.length, documents.length, hasProperty, reminders.length, rooms.length, utilities.length]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${propertyNickname} command center. See what is saved, what needs attention, and what to add next.`}
      />

        <div style={{ display: 'grid', gap: 24 }}>
          <Card tone="dark">
            <h2 style={{ marginTop: 0 }}>{nextStep.title}</h2>
            <p style={{ color: 'rgba(255,248,234,0.78)' }}>{nextStep.description}</p>
            <ActionLink href={nextStep.href}>{nextStep.action}</ActionLink>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Rooms & spaces</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <UtilityBadge label={`${floors} floor${floors === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${rooms.length} room${rooms.length === 1 ? ' or space' : 's & spaces'}`} />
              {roomSpaceSummary.map((item) => (
                <UtilityBadge key={item.roomType} label={item.label} />
              ))}
              <UtilityBadge label={`${utilities.length} utilit${utilities.length === 1 ? 'y' : 'ies'}`} />
              <UtilityBadge label={`${assets.length} asset${assets.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${openRepairCount} open repair${openRepairCount === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${serviceRecords.length} service history item${serviceRecords.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${documents.length} document${documents.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${receipts.length} receipt${receipts.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${openIssueCount} open issue${openIssueCount === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${highUrgentIssueCount} high or urgent issue${highUrgentIssueCount === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${activeTrendFlagCount} active trend${activeTrendFlagCount === 1 ? '' : 's'}`} />
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

            {topAssetCategories.length > 0 ? (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {topAssetCategories.map(([assetType, count]) => (
                  <UtilityBadge key={assetType} label={`${formatEnumLabel(assetType)}: ${count}`} />
                ))}
              </div>
            ) : null}

            <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <ActionLink href="/home-map" variant="secondary">Home Map</ActionLink>
              <ActionLink href="/add-rooms" variant="secondary">Add room or space</ActionLink>
              <ActionLink href="/utilities" variant="secondary">Utilities</ActionLink>
              <ActionLink href="/assets" variant="secondary">Assets</ActionLink>
              <ActionLink href="/maintenance" variant="secondary">Maintenance</ActionLink>
              <ActionLink href="/documents" variant="secondary">Documents</ActionLink>
              <ActionLink href="/handover" variant="secondary">Handover</ActionLink>
              <ActionLink href="/more" variant="secondary">More</ActionLink>
            </div>
          </Card>

          <Card tone="dark">
            <h2 style={{ marginTop: 0 }}>Critical Utilities</h2>
            <p style={{ color: 'rgba(255,248,234,0.78)' }}>
              Where the most important systems live: shutoffs, panels, HVAC, water heater, router, and other home systems.
            </p>
            {criticalUtilities.length === 0 ? (
              <div>
                <p style={{ color: 'rgba(255,248,234,0.78)' }}>Add the shut-offs and systems you’ll want to find fast.</p>
                <ActionLink href="/utilities" variant="secondary">Add utility</ActionLink>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {criticalUtilities.map((utility) => (
                  <Link
                    key={utility.id}
                    href={`/utilities/${utility.id}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    <div style={{ padding: 12, border: '1px solid rgba(224,189,131,0.35)', borderRadius: 6, background: 'rgba(236,226,207,0.08)' }}>
                      <div style={{ fontWeight: 600 }}>{utility.name}</div>
                      <div style={{ color: 'rgba(255,248,234,0.72)', fontSize: '0.875rem' }}>
                        {formatEnumLabel(utility.utility_type)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <ActionLink href="/utilities" variant="secondary" style={{ color: 'var(--text-inverse)', borderColor: 'rgba(236,226,207,0.42)' }}>
                Open utilities
              </ActionLink>
            </div>
          </Card>

          <Card tone="dark">
            <h2 style={{ marginTop: 0 }}>Home Handover</h2>
            <p style={{ color: 'rgba(255,248,234,0.78)' }}>
              Hand the whole home over in one document for family, buyer, maintenance, insurance, or personal archive use.
            </p>
            <p style={{ color: 'rgba(255,248,234,0.78)', marginTop: 0 }}>
              No public link, email, background job, or stored report file is created.
            </p>
            <ActionLink href="/handover" variant="secondary">Build handover</ActionLink>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Sharing Review</h2>
            <p style={{ color: '#6b7280' }}>
              Preview role-based access before future invitations, guests, or share links are enabled.
            </p>
            <p style={{ color: '#6b7280', marginTop: 0 }}>
              This is review-only and does not create public links, emails, guests, or background jobs.
            </p>
            <ActionLink href="/sharing" variant="secondary">Open sharing review</ActionLink>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Service History</h2>
            {recentServiceRecords.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No service history yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {recentServiceRecords.map((record) => (
                  <div
                    key={record.id}
                    style={{
                      padding: 12,
                      border: '1px solid #e5e7eb',
                      borderRadius: 10,
                      background: '#fff'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{record.service_title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {record.service_date} • {formatEnumLabel(record.service_type)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Recent documents</h2>
            {recentDocuments.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No documents uploaded yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {recentDocuments.map((document) => (
                  <div
                    key={document.id}
                    style={{
                      padding: 12,
                      border: '1px solid #e5e7eb',
                      borderRadius: 10,
                      background: '#fff'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{document.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {document.file_name} • {formatEnumLabel(document.document_type)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <ActionLink href="/documents" variant="secondary">Open documents</ActionLink>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Recent receipts</h2>
            {recentReceipts.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No approved receipts yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {recentReceipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    style={{
                      padding: 12,
                      border: '1px solid #e5e7eb',
                      borderRadius: 10,
                      background: '#fff'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{receipt.vendor_name || receipt.description || 'Receipt'}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {receipt.purchase_date || 'No date'} • {formatReceiptAmount(receipt)} • {formatEnumLabel(receipt.category)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <ActionLink href="/receipts" variant="secondary">Open receipts</ActionLink>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Trends</h2>
            {trendFlags.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No trends currently.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {trendFlags.slice(0, 6).map((flag) => (
                  <div key={flag.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 10 }}>
                    <div style={{ fontWeight: 600 }}>{flag.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {flag.description || `${formatEnumLabel(flag.flag_type)} • ${formatEnumLabel(flag.status)} • ${formatEnumLabel(flag.severity)}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Warranty summary</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <UtilityBadge label={`${warrantySummary.active} active`} />
              <UtilityBadge label={`${warrantySummary.expiringSoon} expiring soon`} />
              <UtilityBadge label={`${warrantySummary.expired} expired`} />
              <UtilityBadge label={`${warrantySummary.unknown} unknown`} />
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Reminder summary</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <UtilityBadge label={`${reminderSummary.open} open`} />
              <UtilityBadge label={`${reminderSummary.completed} completed`} />
              <UtilityBadge label={`${reminderSummary.dismissed} dismissed`} />
            </div>

            {upcomingReminders.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No reminders yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {upcomingReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    style={{
                      padding: 12,
                      border: '1px solid #e5e7eb',
                      borderRadius: 10,
                      background: '#fff'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{reminder.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {reminder.due_date || 'No due date'} • {formatEnumLabel(reminder.reminder_type)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Rooms & spaces</h2>
            {!hasProperty ? (
              <div>
                <p style={{ color: '#6b7280' }}>Start your home record.</p>
                <ActionLink href="/create-property" variant="secondary">Create property</ActionLink>
              </div>
            ) : rooms.length === 0 ? (
              <div>
                <p style={{ color: '#6b7280' }}>No rooms yet — let’s map the house.</p>
                <ActionLink href="/add-rooms" variant="secondary">Add rooms & spaces</ActionLink>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {rooms.map((room) => (
                  <Link
                    key={room.id}
                    href={`/rooms/${room.id}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    <div
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 14,
                        padding: 16,
                        background: '#fff'
                      }}
                    >
                      <strong>{room.name}</strong>
                      <div style={{ color: '#6b7280' }}>
                        {formatRoomTypeLabel(room.room_type)} • {formatRoomLocation(room)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </>
    );
  }
