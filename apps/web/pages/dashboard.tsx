import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel, getWarrantyMeta } from '@home-folder/shared';
import { PageHeader, Card, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { DemoImportBanner } from '../components/DemoImportBanner';
import { PendingInvitationsBanner } from '../components/PendingInvitationsBanner';
import {
  getAutomationContext,
  getDevicesForContext,
  getHubsForContext,
  getNetworksForContext,
  getRoutinesForContext
} from '../lib/automation';
import { computeAutomationOverview, type AutomationOverview } from '../lib/automationOverview';
import { computeCompleteness, computeDigest } from '../lib/completeness';
import { getAssetDataContext, getAssetsForContext, type AssetRow } from '../lib/assets';
import { getDemoActiveProperty, getDemoRooms } from '../lib/demoStorage';
import { getDocumentDataContext, getDocumentsForContext, type DocumentRow } from '../lib/documents';
import { getIssueDataContext, getIssuesForContext, type IssueRow } from '../lib/issues';
import { getReminderDataContext, getRemindersForContext, type ReminderRow } from '../lib/reminders';
import { formatReceiptAmount, getReceiptDataContext, getReceiptsForContext, type ReceiptRow } from '../lib/receipts';
import { getRepairDataContext, getRepairsForContext, type RepairRow } from '../lib/repairs';
import { isOutdoorArea } from '../lib/floorOrder';
import { getFloorsForProperty, getRoomsForProperty } from '../lib/rooms';
import { formatRoomLocation, formatRoomTypeLabel, getRoomSpaceSummary } from '../lib/roomLabels';
import { getServiceRecordDataContext, getServiceRecordsForContext, type ServiceRecordRow } from '../lib/serviceRecords';
import { getTrendFlagDataContext, getTrendFlagsForContext, type TrendFlagRow } from '../lib/trendFlags';
import { getUtilitiesForContext, getUtilityDataContext, type UtilityRow } from '../lib/utilities';
import { usePropertyAccess } from '../lib/access';
import { ViewOnlyNotice } from '../components/ViewOnlyNotice';

type Room = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
};

export default function DashboardPage() {
  const access = usePropertyAccess();
  const [propertyNickname, setPropertyNickname] = useState('Your property');
  const [dataMode, setDataMode] = useState<'demo' | 'supabase'>('demo');
  // null = still finding out. Rendering the no-property welcome (with its
  // claim-a-transfer link) during that beat made every dashboard visit flash
  // "Been handed a home?" at people who very much have homes (launch QA
  // 2026-08-03). The hero stays quiet until the answer is real.
  const [hasProperty, setHasProperty] = useState<boolean | null>(null);
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
  const [floorNames, setFloorNames] = useState<string[]>([]);
  const [utilityError, setUtilityError] = useState('');
  const [assetError, setAssetError] = useState('');
  const [reminderError, setReminderError] = useState('');
  const [repairError, setRepairError] = useState('');
  const [serviceRecordError, setServiceRecordError] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [receiptError, setReceiptError] = useState('');
  const [issueError, setIssueError] = useState('');
  const [trendFlagError, setTrendFlagError] = useState('');
  const [roomError, setRoomError] = useState('');
  const [automationSummary, setAutomationSummary] = useState<AutomationOverview | null>(null);
  const [activePropertyId, setActivePropertyId] = useState<string | null | undefined>(undefined);
  const [reloadKey, setReloadKey] = useState(0);

  // Isolated, best-effort automation summary — never blocks the main dashboard.
  useEffect(() => {
    let isMounted = true;
    async function loadAutomation() {
      try {
        const context = await getAutomationContext();
        if (context.mode !== 'supabase') return;
        const [d, h, n, r] = await Promise.all([
          getDevicesForContext(context),
          getHubsForContext(context),
          getNetworksForContext(context),
          getRoutinesForContext(context)
        ]);
        if (isMounted) setAutomationSummary(computeAutomationOverview({ devices: d, hubs: h, networks: n, routines: r }));
      } catch {
        /* automation summary is optional on the dashboard */
      }
    }
    loadAutomation();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setRoomError('');
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
        setActivePropertyId(utilityContext.property?.id ?? null);
        setPropertyNickname(utilityContext.property?.nickname || 'Your property');

        if (utilityContext.property) {
          try {
            const [floors, remoteRooms] = await Promise.all([
              getFloorsForProperty(utilityContext.property.id),
              getRoomsForProperty(utilityContext.property.id)
            ]);

            if (!isMounted) {
              return;
            }

            setFloorNames(floors.map((floor) => floor.name));
            setRooms(
              remoteRooms.map((room) => ({
                id: room.id,
                name: room.name,
                room_type: room.room_type,
                floor_name: room.floor_name
              }))
            );
          } catch (loadError) {
            if (!isMounted) {
              return;
            }
            setFloorNames([]);
            setRooms([]);
            setRoomError(loadError instanceof Error ? loadError.message : 'Failed to load rooms.');
          }
        } else {
          setFloorNames([]);
          setRooms([]);
        }
      } else {
        const demoProperty = getDemoActiveProperty();
        const demoRooms = getDemoRooms();

        setDataMode('demo');
        setHasProperty(Boolean(demoProperty));
        setPropertyNickname(demoProperty?.nickname || 'Your property');
        setRooms(demoRooms);
        setFloorNames(Array.from(new Set(demoRooms.map((room) => room.floor_name))));
      }

    }

    load().catch((loadError) => {
      if (isMounted) {
        setRoomError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard data.');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  // "Back yard", "Outside", and friends are areas, not floors — counting them
  // as floors made a one-story house read as three. Real floors and outdoor
  // areas get their own badges.
  const allFloorNames =
    floorNames.length > 0 ? floorNames : Array.from(new Set(rooms.map((room) => room.floor_name)));
  const floors = allFloorNames.filter((name) => !isOutdoorArea(name)).length;
  const outdoorAreas = allFloorNames.length - floors;
  const roomSpaceSummary = useMemo(() => getRoomSpaceSummary(rooms), [rooms]);

  const completeness = useMemo(
    () =>
      computeCompleteness({
        roomCount: rooms.length,
        utilities,
        assets,
        documents,
        reminders
      }),
    [rooms.length, utilities, assets, documents, reminders]
  );

  const digest = useMemo(
    () => computeDigest({ reminders, assets, serviceRecords, repairs }),
    [reminders, assets, serviceRecords, repairs]
  );

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
      active: assets.filter((asset) => getWarrantyMeta(asset).status === 'active').length,
      expiringSoon: assets.filter((asset) => getWarrantyMeta(asset).status === 'expiring_soon').length,
      expired: assets.filter((asset) => getWarrantyMeta(asset).status === 'expired').length,
      unknown: assets.filter((asset) => getWarrantyMeta(asset).status === 'unknown').length
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
    // One entry per singleton system — a home has one water main and one
    // panel, and recording it twice (welcome flow + utilities page) shouldn't
    // list it twice here. Detectors legitimately repeat, so they all show.
    const singletonTypes = new Set([
      'main_water_shutoff',
      'electrical_panel',
      'gas_shutoff',
      'water_heater',
      'hvac_unit',
      'furnace',
      'air_conditioner',
      'breaker_panel',
      'sump_pump',
      'irrigation_shutoff',
      'internet_modem',
      'router'
    ]);
    const repeatableTypes = new Set(['smoke_detector', 'carbon_monoxide_detector']);

    const seen = new Set<string>();
    const result: UtilityRow[] = [];
    for (const utility of utilities) {
      if (singletonTypes.has(utility.utility_type)) {
        if (seen.has(utility.utility_type)) continue;
        seen.add(utility.utility_type);
        result.push(utility);
      } else if (repeatableTypes.has(utility.utility_type)) {
        result.push(utility);
      }
    }
    return result;
  }, [utilities]);

  // Critical systems with no entry yet — the ones you want findable before
  // you need them. Surfaced as prompts under the recorded list.
  const missingCriticalUtilities = useMemo(() => {
    const recorded = new Set<string>(utilities.map((utility) => utility.utility_type));
    const wanted: Array<{ type: string; label: string }> = [
      { type: 'main_water_shutoff', label: 'Main water shut-off' },
      { type: 'electrical_panel', label: 'Electrical panel' },
      { type: 'gas_shutoff', label: 'Gas shut-off' },
      { type: 'water_heater', label: 'Water heater' },
      { type: 'furnace', label: 'Furnace / HVAC' },
      { type: 'smoke_detector', label: 'Smoke detectors' },
      { type: 'carbon_monoxide_detector', label: 'CO detectors' },
      { type: 'irrigation_shutoff', label: 'Sprinkler shut-off' }
    ];
    return wanted.filter((entry) => {
      // Any heating/cooling entry satisfies the furnace prompt.
      if (entry.type === 'furnace') {
        return !recorded.has('furnace') && !recorded.has('hvac_unit') && !recorded.has('air_conditioner');
      }
      return !recorded.has(entry.type);
    });
  }, [utilities]);

  const openRepairCount = useMemo(
    () => repairs.filter((repair) => repair.status === 'open').length,
    [repairs]
  );

  const nextStep = useMemo(() => {
    if (hasProperty === null) {
      return null;
    }

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
          {dataMode === 'supabase' ? (
            <PendingInvitationsBanner onAccepted={() => setReloadKey((key) => key + 1)} />
          ) : null}

          {dataMode === 'supabase' ? (
            <DemoImportBanner
              propertyId={activePropertyId}
              onImported={() => setReloadKey((key) => key + 1)}
            />
          ) : null}

          {nextStep ? (
            <Card tone="dark">
              <h2 style={{ marginTop: 0 }}>{nextStep.title}</h2>
              <p style={{ color: 'rgba(255,248,234,0.78)' }}>{nextStep.description}</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <ActionLink href={nextStep.href}>{nextStep.action}</ActionLink>
                {hasProperty === false ? (
                  <ActionLink href="/claim" variant="secondary">Been handed a home? Claim it with your code</ActionLink>
                ) : null}
              </div>
            </Card>
          ) : (
            <Card tone="dark">
              <h2 style={{ marginTop: 0 }}>Opening your record&hellip;</h2>
              <p style={{ color: 'rgba(255,248,234,0.78)', marginBottom: 0 }}>One moment.</p>
            </Card>
          )}

          {hasProperty ? (
            <div
              style={{
                display: 'grid',
                gap: 24,
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
              }}
            >
              <Card id="home-record">
                <div className="hb-leader" style={{ marginBottom: 12 }}>
                  <h2 style={{ margin: 0 }}>Home record</h2>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 34,
                      fontWeight: 600,
                      color:
                        completeness.score >= 80
                          ? 'var(--status-good)'
                          : completeness.score >= 50
                            ? 'var(--color-brass-deep)'
                            : 'var(--status-urgent)'
                    }}
                  >
                    {completeness.score}
                    <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>/100</span>
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: 'rgba(44,31,24,0.12)',
                    overflow: 'hidden',
                    marginBottom: 14
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background:
                        'linear-gradient(90deg, var(--color-brass-deep), var(--color-brass-pale))',
                      // Compositor-only fill: scaleX instead of animating width,
                      // so the meter never triggers layout.
                      transform: `scaleX(${completeness.score / 100})`,
                      transformOrigin: 'left',
                      transition: 'transform 600ms cubic-bezier(0.22,0.9,0.3,1)'
                    }}
                  />
                </div>
                {completeness.nextActions.length > 0 ? (
                  <>
                    <p style={{ color: 'var(--text-muted)', marginTop: 0, marginBottom: 10, fontSize: 14 }}>
                      Strengthen the record next:
                    </p>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {completeness.nextActions.map((action) => (
                        <Link
                          key={action.id}
                          href={action.href}
                          className="hb-toc-row"
                          style={{ padding: '8px 10px', border: '1px solid var(--border-subtle)' }}
                        >
                          <span className="hb-toc-num">+{action.possible - action.earned}</span>
                          <span style={{ fontWeight: 600 }}>{action.label}</span>
                          <span className="hb-toc-dots" aria-hidden="true" />
                          <span className="hb-toc-detail">{action.detail}</span>
                        </Link>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ color: 'var(--status-good)', fontWeight: 600, margin: 0 }}>
                    Your home record is complete. Beautifully kept.
                  </p>
                )}
              </Card>

              <Card id="this-week">
                <h2 style={{ marginTop: 0 }}>This week at home</h2>
                {digest.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                    Nothing needs attention in the next two weeks. Enjoy the quiet.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {digest.map((item) => {
                      const tone =
                        item.kind === 'overdue'
                          ? 'var(--status-urgent)'
                          : item.kind === 'due_soon' || item.kind === 'service'
                            ? 'var(--color-brass-deep)'
                            : 'var(--text-muted)';
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className="hb-toc-row"
                          style={{ padding: '8px 10px' }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              background: tone,
                              flexShrink: 0,
                              transform: 'translateY(-2px)'
                            }}
                          />
                          <span style={{ fontWeight: 600 }}>{item.title}</span>
                          <span className="hb-toc-dots" aria-hidden="true" />
                          <span className="hb-toc-detail" style={{ color: tone }}>
                            {item.detail}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 24,
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
              }}
            >
              <Card id="home-record">
                <h2 style={{ marginTop: 0 }}>Home record</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                  No home on file yet. Once one is saved, its record score and next steps live here.
                </p>
                <ActionLink href="/welcome" variant="secondary">Start your home record</ActionLink>
              </Card>

              <Card id="this-week">
                <h2 style={{ marginTop: 0 }}>This week at home</h2>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Nothing scheduled — add your first rooms and systems to see what&apos;s coming up.
                </p>
              </Card>
            </div>
          )}

          {automationSummary && (automationSummary.totalDevices > 0 || automationSummary.hubs > 0 || automationSummary.networks > 0 || automationSummary.routines > 0) ? (
            <Card id="smart-home">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0 }}>Smart home</h2>
                <ActionLink href="/automation" variant="secondary">Open</ActionLink>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <UtilityBadge label={`${automationSummary.totalDevices} device${automationSummary.totalDevices === 1 ? '' : 's'}`} />
                {automationSummary.needsAttention > 0 ? <UtilityBadge label={`${automationSummary.needsAttention} need attention`} tone="attention" /> : null}
                {automationSummary.lowBattery > 0 ? <UtilityBadge label={`${automationSummary.lowBattery} low battery`} tone="attention" /> : null}
                {automationSummary.offline > 0 ? <UtilityBadge label={`${automationSummary.offline} offline`} tone="urgent" /> : null}
                {automationSummary.untestedCriticalRoutines > 0 ? <UtilityBadge label={`${automationSummary.untestedCriticalRoutines} critical automation${automationSummary.untestedCriticalRoutines === 1 ? '' : 's'} untested`} tone="attention" /> : null}
                {automationSummary.cloudDependent > 0 ? <UtilityBadge label={`${automationSummary.cloudDependent} need internet`} /> : null}
                {automationSummary.needsAttention === 0 && automationSummary.lowBattery === 0 && automationSummary.offline === 0 && automationSummary.untestedCriticalRoutines === 0 && automationSummary.brokenRoutines === 0 ? <UtilityBadge label="All good" tone="good" /> : null}
              </div>
            </Card>
          ) : null}

          <Card id="rooms-spaces">
            <h2 style={{ marginTop: 0 }}>Rooms & spaces</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <UtilityBadge label={`${floors} floor${floors === 1 ? '' : 's'}`} />
              {outdoorAreas > 0 ? (
                <UtilityBadge label={`${outdoorAreas} outdoor area${outdoorAreas === 1 ? '' : 's'}`} />
              ) : null}
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

            <p style={{ marginTop: 12, marginBottom: 0, color: 'var(--text-muted)' }}>
              {dataMode === 'supabase'
                ? 'Saved to your account.'
                : 'Demo data is stored only in this browser.'}
            </p>
            {roomError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
                {roomError}
              </p>
            ) : null}
            {utilityError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
                {utilityError}
              </p>
            ) : null}
            {assetError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
                {assetError}
              </p>
            ) : null}
            {reminderError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
                {reminderError}
              </p>
            ) : null}
            {repairError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
                {repairError}
              </p>
            ) : null}
            {serviceRecordError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
                {serviceRecordError}
              </p>
            ) : null}
            {documentError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
                {documentError}
              </p>
            ) : null}
            {receiptError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
                {receiptError}
              </p>
            ) : null}
            {issueError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
                {issueError}
              </p>
            ) : null}
            {trendFlagError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
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
              {access.loading || access.canWrite ? (
                <ActionLink href="/add-rooms" variant="secondary">Add room or space</ActionLink>
              ) : (
                <ViewOnlyNotice role={access.role} action="add rooms" inline />
              )}
              <ActionLink href="/utilities" variant="secondary">Utilities</ActionLink>
              <ActionLink href="/assets" variant="secondary">Assets</ActionLink>
              <ActionLink href="/maintenance" variant="secondary">Maintenance</ActionLink>
              <ActionLink href="/documents" variant="secondary">Documents</ActionLink>
              <ActionLink href="/handover" variant="secondary">Handover</ActionLink>
              <ActionLink href="/more" variant="secondary">More</ActionLink>
            </div>
          </Card>

          <Card tone="dark" id="critical-utilities">
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
            {missingCriticalUtilities.length > 0 ? (
              <div style={{ marginTop: 14 }}>
                <p style={{ color: 'rgba(255,248,234,0.72)', margin: '0 0 8px', fontSize: '0.875rem' }}>
                  Not recorded yet — worth finding before you need them:
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {missingCriticalUtilities.map((entry) => (
                    <ActionLink
                      key={entry.type}
                      href={`/add-utility?utilityType=${entry.type}`}
                      variant="secondary"
                      style={{ color: 'var(--text-inverse)', borderColor: 'rgba(236,226,207,0.42)', minHeight: 36, padding: '6px 12px', fontSize: 13 }}
                    >
                      {`Add ${entry.label.toLowerCase()}`}
                    </ActionLink>
                  ))}
                </div>
              </div>
            ) : null}
            <div style={{ marginTop: 12 }}>
              <ActionLink href="/utilities" variant="secondary" style={{ color: 'var(--text-inverse)', borderColor: 'rgba(236,226,207,0.42)' }}>
                Open utilities
              </ActionLink>
            </div>
          </Card>

          <Card id="service-history">
            <h2 style={{ marginTop: 0 }}>Service History</h2>
            {recentServiceRecords.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No service history yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {recentServiceRecords.map((record) => (
                  <div
                    key={record.id}
                    style={{
                      padding: 12,
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      background: '#fff'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{record.service_title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {record.service_date} • {formatEnumLabel(record.service_type)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card id="recent-documents">
            <h2 style={{ marginTop: 0 }}>Recent documents</h2>
            {recentDocuments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No documents uploaded yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {recentDocuments.map((document) => (
                  <div
                    key={document.id}
                    style={{
                      padding: 12,
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      background: '#fff'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{document.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
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

          <Card id="recent-receipts">
            <h2 style={{ marginTop: 0 }}>Recent receipts</h2>
            {recentReceipts.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No approved receipts yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {recentReceipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    style={{
                      padding: 12,
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      background: '#fff'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{receipt.vendor_name || receipt.description || 'Receipt'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
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

          <Card id="trends">
            <h2 style={{ marginTop: 0 }}>Trends</h2>
            {trendFlags.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No trends currently.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {trendFlags.slice(0, 6).map((flag) => (
                  <div key={flag.id} style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
                    <div style={{ fontWeight: 600 }}>{flag.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {flag.description || `${formatEnumLabel(flag.flag_type)} • ${formatEnumLabel(flag.status)} • ${formatEnumLabel(flag.severity)}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card id="warranties">
            <h2 style={{ marginTop: 0 }}>Warranty summary</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <UtilityBadge label={`${warrantySummary.active} active`} />
              <UtilityBadge label={`${warrantySummary.expiringSoon} expiring soon`} />
              <UtilityBadge label={`${warrantySummary.expired} expired`} />
              <UtilityBadge label={`${warrantySummary.unknown} unknown`} />
            </div>
          </Card>

          <Card id="reminders">
            <h2 style={{ marginTop: 0 }}>Reminder summary</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <UtilityBadge label={`${reminderSummary.open} open`} />
              <UtilityBadge label={`${reminderSummary.completed} completed`} />
              <UtilityBadge label={`${reminderSummary.dismissed} dismissed`} />
            </div>

            {upcomingReminders.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No reminders yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {upcomingReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    style={{
                      padding: 12,
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      background: '#fff'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{reminder.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {reminder.due_date || 'No due date'} • {formatEnumLabel(reminder.reminder_type)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card id="room-list">
            <h2 style={{ marginTop: 0 }}>All rooms</h2>
            {hasProperty === null ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading&hellip;</p>
            ) : !hasProperty ? (
              <div>
                <p style={{ color: 'var(--text-muted)' }}>Start your home record.</p>
                <ActionLink href="/create-property" variant="secondary">Create property</ActionLink>
              </div>
            ) : rooms.length === 0 ? (
              <div>
                <p style={{ color: 'var(--text-muted)' }}>No rooms yet — let’s map the house.</p>
                {access.loading || access.canWrite ? (
                  <ActionLink href="/add-rooms" variant="secondary">Add rooms & spaces</ActionLink>
                ) : null}
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
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 14,
                        padding: 16,
                        background: '#fff'
                      }}
                    >
                      <strong>{room.name}</strong>
                      <div style={{ color: 'var(--text-muted)' }}>
                        {formatRoomTypeLabel(room.room_type)} • {formatRoomLocation(room)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Occasional-use tools stay at the bottom — the dashboard reads in
              order of expected use, and a handover or sharing review happens a
              few times in a home's life, not weekly. */}
          <Card tone="dark" id="handover">
            <h2 style={{ marginTop: 0 }}>Home Handover</h2>
            <p style={{ color: 'rgba(255,248,234,0.78)' }}>
              Hand the whole home over in one document for family, buyer, maintenance, insurance, or personal archive use.
            </p>
            <p style={{ color: 'rgba(255,248,234,0.78)', marginTop: 0 }}>
              No public link, email, background job, or stored report file is created.
            </p>
            <ActionLink href="/handover" variant="secondary">Build handover</ActionLink>
          </Card>

          <Card id="sharing">
            <h2 style={{ marginTop: 0 }}>Sharing Review</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Invite trusted people with role-scoped access, and preview exactly what each role sees before you share.
            </p>
            <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
              When a home changes hands, you can transfer ownership of the record from here too.
            </p>
            <ActionLink href="/sharing" variant="secondary">Open sharing</ActionLink>
          </Card>
        </div>
      </>
    );
  }
