import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatEnumLabel } from '@home-bible/shared';
import { Button, Card, PageHeader, UtilityBadge } from '@home-bible/ui';
import {
  getDefaultHandoverSections,
  getHandoverContext,
  HANDOVER_REPORT_TYPE_LABELS,
  HANDOVER_REPORT_TYPES,
  HANDOVER_SECTION_LABELS,
  HANDOVER_SECTIONS,
  loadHandoverReport,
  type HandoverContext,
  type HandoverReportData,
  type HandoverReportType,
  type HandoverSection
} from '../lib/handover';

type LookupMaps = {
  rooms: Map<string, string>;
  assets: Map<string, string>;
  utilities: Map<string, string>;
  reminders: Map<string, string>;
  repairs: Map<string, string>;
  serviceRecords: Map<string, string>;
  issues: Map<string, string>;
  trendFlags: Map<string, string>;
};

type Linkable = {
  room_id?: string | null;
  asset_id?: string | null;
  utility_id?: string | null;
  reminder_id?: string | null;
  repair_id?: string | null;
  service_record_id?: string | null;
  issue_id?: string | null;
  trend_flag_id?: string | null;
};

const fieldStyle = {
  padding: 10,
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff'
};

const reportSurfaceStyle = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 18,
  padding: 28,
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)'
};

const subtleText = { color: '#6b7280' };

const forbiddenSensitivePatterns = [
  /access\s*codes?/i,
  /lock\s*codes?/i,
  /garage\s*codes?/i,
  /safe\s*codes?/i,
  /alarm\s*codes?/i,
  /wi[-\s]?fi\s*passwords?/i,
  /wifi\s*passwords?/i,
  /hidden\s*keys?/i,
  /door\s*codes?/i,
  /keypad\s*codes?/i
];

function containsForbiddenSensitiveText(value: string) {
  return forbiddenSensitivePatterns.some((pattern) => pattern.test(value));
}

function safeText(value: string | null | undefined, fallback = 'Hidden by privacy rule') {
  if (!value || !value.trim()) {
    return null;
  }

  return containsForbiddenSensitiveText(value) ? fallback : value.trim();
}

function safeFileName(value: string | null | undefined) {
  const fileName = safeText(value);
  if (!fileName || /^https?:\/\//i.test(fileName) || /^www\./i.test(fileName)) {
    return null;
  }

  return fileName;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatAmount(amount: number | null, currency: string) {
  if (amount === null) return 'Amount not set';

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  } catch {
    return `${currency || 'USD'} ${amount.toFixed(2)}`;
  }
}

function warrantyExpiration(asset: HandoverReportData['assets'][number]) {
  if (asset.warranty_expires_at) {
    return asset.warranty_expires_at;
  }

  if (!asset.purchase_date || !asset.warranty_length_months) {
    return null;
  }

  const date = new Date(asset.purchase_date);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setMonth(date.getMonth() + asset.warranty_length_months);
  return date.toISOString().slice(0, 10);
}

function warrantyStatus(asset: HandoverReportData['assets'][number]) {
  const expiresAt = warrantyExpiration(asset);
  if (!expiresAt) return 'unknown';

  const daysRemaining = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= 30) return 'expiring_soon';
  return 'active';
}

function buildLookups(data: HandoverReportData): LookupMaps {
  return {
    rooms: new Map(data.rooms.map((room) => [room.id, room.name])),
    assets: new Map(data.assets.map((asset) => [asset.id, asset.name])),
    utilities: new Map(data.utilities.map((utility) => [utility.id, utility.name])),
    reminders: new Map(data.reminders.map((reminder) => [reminder.id, reminder.title])),
    repairs: new Map(data.repairs.map((repair) => [repair.id, repair.title])),
    serviceRecords: new Map(data.serviceRecords.map((record) => [record.id, record.service_title])),
    issues: new Map(data.issues.map((issue) => [issue.id, issue.title])),
    trendFlags: new Map(data.trendFlags.map((flag) => [flag.id, flag.title]))
  };
}

function linkedLabel(record: Linkable, lookups: LookupMaps) {
  if (record.room_id) return lookups.rooms.get(record.room_id) || 'Room record';
  if (record.asset_id) return lookups.assets.get(record.asset_id) || 'Asset record';
  if (record.utility_id) return lookups.utilities.get(record.utility_id) || 'Utility record';
  if (record.reminder_id) return lookups.reminders.get(record.reminder_id) || 'Reminder record';
  if (record.repair_id) return lookups.repairs.get(record.repair_id) || 'Repair record';
  if (record.service_record_id) return lookups.serviceRecords.get(record.service_record_id) || 'Service record';
  if (record.issue_id) return lookups.issues.get(record.issue_id) || 'Issue record';
  if (record.trend_flag_id) return lookups.trendFlags.get(record.trend_flag_id) || 'Trend flag record';
  return 'Property';
}

function SectionShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="handover-major-section" style={{ paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
      <h2 style={{ marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  );
}

function EmptySection({ label }: { label: string }) {
  return <p style={subtleText}>No {label.toLowerCase()} saved yet.</p>;
}

function SummaryGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="handover-summary-grid"
      style={{
        display: 'grid',
        gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
      }}
    >
      {children}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
      <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>{value}</div>
    </div>
  );
}

export default function HandoverPage() {
  const [context, setContext] = useState<HandoverContext | null>(null);
  const [reportType, setReportType] = useState<HandoverReportType>('family');
  const [sections, setSections] = useState<HandoverSection[]>(() => getDefaultHandoverSections('family'));
  const [reportData, setReportData] = useState<HandoverReportData | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadContext() {
      setLoadingContext(true);
      setError('');

      try {
        const nextContext = await getHandoverContext();
        if (isMounted) {
          setContext(nextContext);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load handover context.');
        }
      } finally {
        if (isMounted) {
          setLoadingContext(false);
        }
      }
    }

    loadContext();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedSections = useMemo(() => new Set(sections), [sections]);

  const modeLabel = context?.mode === 'supabase' ? 'Saved to your account.' : 'Demo data is stored only in this browser.';
  const canPreview = !loadingContext && Boolean(context?.property) && sections.length > 0;

  const toggleSection = (section: HandoverSection) => {
    setReportData(null);
    setNotice('');
    setSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : HANDOVER_SECTIONS.filter((item) => current.includes(item) || item === section)
    );
  };

  const handleReportTypeChange = (nextType: HandoverReportType) => {
    setReportType(nextType);
    setSections(getDefaultHandoverSections(nextType));
    setReportData(null);
    setNotice('');
  };

  const previewReport = async () => {
    if (sections.length === 0) {
      setError('Choose at least one report section.');
      return;
    }

    setLoadingPreview(true);
    setError('');
    setNotice('');

    try {
      const data = await loadHandoverReport({ reportType, sections });
      setReportData(data);
      setContext(data.context);
      setNotice('Preview generated locally in this browser.');
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Failed to generate handover preview.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const printReport = () => {
    window.print();
  };

  return (
    <>
      <PageHeader
        title="Home Handover"
        description="Build a safe, reviewable report for family, buyer, maintenance, insurance, or personal archive use."
      />

      <div className="handover-no-print" style={{ display: 'grid', gap: 24 }}>
        <Card>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <UtilityBadge label={modeLabel} />
            {context?.property ? <UtilityBadge label={context.property.nickname} /> : null}
            <UtilityBadge label="Browser print only" />
          </div>

          <p style={{ ...subtleText, marginTop: 0 }}>
            This report is generated locally in your browser from existing saved data. No public link, email, background job, or stored report file is created.
          </p>
          <p style={{ ...subtleText, marginTop: 0 }}>
            Privacy reminder: reports omit sensitive entry details, passwords, private file links, storage paths, and signed file URLs.
          </p>
          <p style={{ ...subtleText, marginTop: 0 }}>
            Before future sharing is enabled, review who should see each report type in Sharing & Access Review.
          </p>
          <Link href="/sharing">
            <Button type="button" style={{ background: '#4b5563', marginBottom: 16 }}>
              Review sharing access
            </Button>
          </Link>

          {loadingContext ? <p style={subtleText}>Loading report options...</p> : null}
          {error ? <p style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</p> : null}
          {notice ? <p style={{ color: '#065f46', fontWeight: 700 }}>{notice}</p> : null}

          {!loadingContext && !context?.property ? (
            <div style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 12, padding: 14 }}>
              <strong>No property found yet.</strong>
              <p style={{ ...subtleText, marginBottom: 0 }}>
                {context?.mode === 'supabase'
                  ? 'Create or join a property before generating a handover report.'
                  : 'Demo data is stored only in this browser. Add a demo property and rooms first to preview report content.'}
              </p>
            </div>
          ) : null}
        </Card>

        <Card>
          <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 700 }}>Report type</span>
              <select
                value={reportType}
                onChange={(event) => handleReportTypeChange(event.target.value as HandoverReportType)}
                style={fieldStyle}
              >
                {HANDOVER_REPORT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {HANDOVER_REPORT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Included sections</div>
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
                {HANDOVER_SECTIONS.map((section) => (
                  <label
                    key={section}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      padding: 8,
                      border: '1px solid #e5e7eb',
                      borderRadius: 10,
                      background: selectedSections.has(section) ? '#fffbeb' : '#fff'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSections.has(section)}
                      onChange={() => toggleSection(section)}
                    />
                    <span>{HANDOVER_SECTION_LABELS[section]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            <Button type="button" onClick={previewReport} disabled={!canPreview || loadingPreview}>
              {loadingPreview ? 'Generating preview...' : 'Preview report'}
            </Button>
            <Button
              type="button"
              onClick={printReport}
              disabled={!reportData}
              style={{ background: reportData ? '#4b5563' : '#9ca3af' }}
            >
              Print / save to PDF
            </Button>
          </div>
        </Card>
      </div>

      {reportData ? <HandoverPreview data={reportData} /> : null}

      <style jsx global>{`
        @media print {
          nav,
          .handover-no-print {
            display: none !important;
          }

          body {
            background: #fff !important;
          }

          main {
            padding: 0 !important;
          }

          .handover-report {
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }

          .handover-major-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .handover-major-section + .handover-major-section {
            break-before: page;
            page-break-before: always;
          }
        }
      `}</style>
    </>
  );
}

function HandoverPreview({ data }: { data: HandoverReportData }) {
  const lookups = useMemo(() => buildLookups(data), [data]);
  const selectedSections = new Set(data.sections);
  const approvedReceipts = data.receipts.filter((receipt) => receipt.approval_status === 'approved');
  const showReceiptAmounts = data.reportType === 'personal_archive' || data.reportType === 'insurance';
  const openRepairs = data.repairs.filter((repair) => repair.status !== 'completed' && repair.status !== 'cancelled');
  const openIssues = data.issues.filter((issue) => issue.status !== 'resolved' && issue.status !== 'dismissed');
  const urgentRepairs = openRepairs.filter((repair) => repair.priority === 'urgent' || repair.priority === 'high');
  const urgentIssues = openIssues.filter((issue) => issue.severity === 'urgent' || issue.severity === 'high');
  const criticalUtilities = data.utilities.filter((utility) =>
    [
      'main_water_shutoff',
      'electrical_panel',
      'gas_shutoff',
      'breaker_panel',
      'water_heater',
      'hvac_unit',
      'furnace',
      'air_conditioner',
      'sump_pump',
      'irrigation_shutoff',
      'smoke_detector',
      'carbon_monoxide_detector'
    ].includes(utility.utility_type)
  );

  const roomsByFloor = data.rooms.reduce<Record<string, typeof data.rooms>>((acc, room) => {
    const floorName = room.floor_name || 'Unassigned';
    acc[floorName] = acc[floorName] || [];
    acc[floorName].push(room);
    return acc;
  }, {});

  return (
    <article className="handover-report" style={{ ...reportSurfaceStyle, marginTop: 24 }}>
      <header style={{ borderBottom: '2px solid #111827', paddingBottom: 18, marginBottom: 20 }}>
        <div style={{ color: '#92400e', fontWeight: 800, letterSpacing: 0, textTransform: 'uppercase', fontSize: 12 }}>
          Home Bible handover report
        </div>
        <h1 style={{ margin: '6px 0', fontSize: 34, lineHeight: 1.1 }}>
          {safeText(data.context.property?.nickname) || 'Home'} · {HANDOVER_REPORT_TYPE_LABELS[data.reportType]}
        </h1>
        <p style={{ ...subtleText, margin: 0 }}>Generated {formatDateTime(data.generatedAt)}</p>
      </header>

      <SummaryGrid>
        <SummaryTile label="Report type" value={HANDOVER_REPORT_TYPE_LABELS[data.reportType]} />
        <SummaryTile label="Property" value={safeText(data.context.property?.nickname) || 'Property'} />
        <SummaryTile label="Mode" value={data.context.mode === 'supabase' ? 'Signed-in Supabase' : 'Demo'} />
        <SummaryTile label="Included sections" value={data.sections.length} />
      </SummaryGrid>

      <section style={{ marginTop: 20 }}>
        <h2>Included sections</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {data.sections.map((section) => (
            <UtilityBadge key={section} label={HANDOVER_SECTION_LABELS[section]} />
          ))}
        </div>
        {data.sectionErrors.length > 0 ? (
          <div style={{ border: '1px solid #fecaca', borderRadius: 12, padding: 12, marginTop: 14, color: '#b91c1c' }}>
            <strong>Some sections could not load.</strong>
            <ul>
              {data.sectionErrors.map((sectionError) => (
                <li key={sectionError}>{sectionError}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {selectedSections.has('property_summary') ? (
        <SectionShell title="Property summary">
          <SummaryGrid>
            <SummaryTile label="Property type" value={formatEnumLabel(data.context.property?.property_type || 'property')} />
            <SummaryTile label="Floors" value={data.floors.length} />
            <SummaryTile label="Rooms" value={data.rooms.length} />
            <SummaryTile label="Utilities loaded" value={data.utilities.length} />
          </SummaryGrid>
        </SectionShell>
      ) : null}

      {selectedSections.has('emergency_overview') ? (
        <SectionShell title="Emergency overview">
          {criticalUtilities.length === 0 && urgentRepairs.length === 0 && urgentIssues.length === 0 ? (
            <p style={subtleText}>No emergency-oriented utility records, urgent repairs, or high-severity issues found.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {criticalUtilities.length > 0 ? (
                <div>
                  <h3>Key utilities and shutoffs</h3>
                  <ItemList>
                    {criticalUtilities.map((utility) => (
                      <li key={utility.id}>
                        <strong>{safeText(utility.name) || 'Utility'}</strong> · {formatEnumLabel(utility.utility_type)}
                        <DetailLine value={`Location: ${safeText(utility.location_notes) || linkedLabel(utility, lookups)}`} />
                        <DetailLine value={safeText(utility.emergency_notes)} />
                      </li>
                    ))}
                  </ItemList>
                </div>
              ) : null}
              {urgentRepairs.length > 0 ? (
                <div>
                  <h3>Urgent or high-priority repairs</h3>
                  <ItemList>
                    {urgentRepairs.map((repair) => (
                      <li key={repair.id}>
                        <strong>{safeText(repair.title) || 'Repair'}</strong> · {formatEnumLabel(repair.priority)} · {formatEnumLabel(repair.status)}
                        <DetailLine value={linkedLabel(repair, lookups)} />
                      </li>
                    ))}
                  </ItemList>
                </div>
              ) : null}
              {urgentIssues.length > 0 ? (
                <div>
                  <h3>High-severity issues</h3>
                  <ItemList>
                    {urgentIssues.map((issue) => (
                      <li key={issue.id}>
                        <strong>{safeText(issue.title) || 'Issue'}</strong> · {formatEnumLabel(issue.severity)} · {formatEnumLabel(issue.status)}
                        <DetailLine value={linkedLabel(issue, lookups)} />
                      </li>
                    ))}
                  </ItemList>
                </div>
              ) : null}
            </div>
          )}
        </SectionShell>
      ) : null}

      {selectedSections.has('rooms') ? (
        <SectionShell title="Rooms">
          {data.rooms.length === 0 ? (
            <EmptySection label="Rooms" />
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {Object.entries(roomsByFloor).map(([floorName, rooms]) => (
                <div key={floorName}>
                  <h3>{safeText(floorName) || 'Floor'}</h3>
                  <ItemList>
                    {rooms.map((room) => (
                      <li key={room.id}>
                        <strong>{safeText(room.name) || 'Room'}</strong> · {formatEnumLabel(room.room_type)}
                      </li>
                    ))}
                  </ItemList>
                </div>
              ))}
            </div>
          )}
        </SectionShell>
      ) : null}

      {selectedSections.has('utilities') ? (
        <SectionShell title="Utilities">
          {data.utilities.length === 0 ? (
            <EmptySection label="Utilities" />
          ) : (
            <ItemList>
              {data.utilities.map((utility) => (
                <li key={utility.id}>
                  <strong>{safeText(utility.name) || 'Utility'}</strong> · {formatEnumLabel(utility.utility_type)}
                  <DetailLine value={linkedLabel(utility, lookups)} />
                  <DetailLine value={safeText(utility.location_notes)} />
                  <DetailLine value={safeText(utility.emergency_notes)} />
                </li>
              ))}
            </ItemList>
          )}
        </SectionShell>
      ) : null}

      {selectedSections.has('assets') ? (
        <SectionShell title="Assets">
          {data.assets.length === 0 ? (
            <EmptySection label="Assets" />
          ) : (
            <ItemList>
              {data.assets.map((asset) => (
                <li key={asset.id}>
                  <strong>{safeText(asset.name) || 'Asset'}</strong> · {formatEnumLabel(asset.asset_type)}
                  <DetailLine value={linkedLabel(asset, lookups)} />
                  <DetailLine value={[safeText(asset.brand), safeText(asset.model)].filter(Boolean).join(' · ') || null} />
                  <DetailLine value={`Warranty: ${formatEnumLabel(warrantyStatus(asset))}`} />
                </li>
              ))}
            </ItemList>
          )}
        </SectionShell>
      ) : null}

      {selectedSections.has('warranties') ? (
        <SectionShell title="Warranties">
          {data.assets.length === 0 ? (
            <EmptySection label="Warranty records" />
          ) : (
            <ItemList>
              {data.assets.map((asset) => (
                <li key={asset.id}>
                  <strong>{safeText(asset.name) || 'Asset'}</strong> · {formatEnumLabel(warrantyStatus(asset))}
                  <DetailLine value={`Expires: ${formatDate(warrantyExpiration(asset))}`} />
                  <DetailLine value={`Coverage length: ${asset.warranty_length_months ? `${asset.warranty_length_months} months` : 'Not set'}`} />
                </li>
              ))}
            </ItemList>
          )}
        </SectionShell>
      ) : null}

      {selectedSections.has('reminders') ? (
        <SectionShell title="Reminders">
          {data.reminders.length === 0 ? (
            <EmptySection label="Reminders" />
          ) : (
            <ItemList>
              {data.reminders.map((reminder) => (
                <li key={reminder.id}>
                  <strong>{safeText(reminder.title) || 'Reminder'}</strong> · {formatEnumLabel(reminder.status)} · {formatEnumLabel(reminder.priority)}
                  <DetailLine value={`Due: ${formatDate(reminder.due_date)}`} />
                  <DetailLine value={linkedLabel(reminder, lookups)} />
                  <DetailLine value={safeText(reminder.description)} />
                </li>
              ))}
            </ItemList>
          )}
        </SectionShell>
      ) : null}

      {selectedSections.has('repairs') ? (
        <SectionShell title="Repairs">
          {data.repairs.length === 0 ? (
            <EmptySection label="Repairs" />
          ) : (
            <ItemList>
              {data.repairs.map((repair) => (
                <li key={repair.id}>
                  <strong>{safeText(repair.title) || 'Repair'}</strong> · {formatEnumLabel(repair.repair_type)} · {formatEnumLabel(repair.status)}
                  <DetailLine value={`Reported: ${formatDate(repair.reported_date)}`} />
                  <DetailLine value={`Completed: ${formatDate(repair.completed_date)}`} />
                  <DetailLine value={linkedLabel(repair, lookups)} />
                  <DetailLine value={safeText(repair.description)} />
                  {data.reportType === 'personal_archive' || data.reportType === 'insurance' ? (
                    <DetailLine value={`Cost: ${repair.actual_cost !== null ? formatAmount(repair.actual_cost, 'USD') : repair.estimated_cost !== null ? formatAmount(repair.estimated_cost, 'USD') : 'Not set'}`} />
                  ) : null}
                </li>
              ))}
            </ItemList>
          )}
        </SectionShell>
      ) : null}

      {selectedSections.has('service_records') ? (
        <SectionShell title="Service records">
          {data.serviceRecords.length === 0 ? (
            <EmptySection label="Service records" />
          ) : (
            <ItemList>
              {data.serviceRecords.map((record) => (
                <li key={record.id}>
                  <strong>{safeText(record.service_title) || 'Service record'}</strong> · {formatEnumLabel(record.service_type)}
                  <DetailLine value={`Date: ${formatDate(record.service_date)}`} />
                  <DetailLine value={safeText(record.provider_name) ? `Provider: ${safeText(record.provider_name)}` : null} />
                  <DetailLine value={linkedLabel(record, lookups)} />
                  <DetailLine value={safeText(record.summary)} />
                </li>
              ))}
            </ItemList>
          )}
        </SectionShell>
      ) : null}

      {selectedSections.has('issues') ? (
        <SectionShell title="Issues">
          {data.issues.length === 0 ? (
            <EmptySection label="Issues" />
          ) : (
            <ItemList>
              {data.issues.map((issue) => (
                <li key={issue.id}>
                  <strong>{safeText(issue.title) || 'Issue'}</strong> · {formatEnumLabel(issue.issue_type)} · {formatEnumLabel(issue.severity)} · {formatEnumLabel(issue.status)}
                  <DetailLine value={`First seen: ${formatDate(issue.first_seen_date)}`} />
                  <DetailLine value={`Resolved: ${formatDate(issue.resolved_date)}`} />
                  <DetailLine value={linkedLabel(issue, lookups)} />
                  {data.reportType !== 'buyer' ? <DetailLine value={safeText(issue.description)} /> : null}
                </li>
              ))}
            </ItemList>
          )}
        </SectionShell>
      ) : null}

      {selectedSections.has('trend_flags') ? (
        <SectionShell title="Trend flags">
          {data.trendFlags.length === 0 ? (
            <EmptySection label="Trend flags" />
          ) : (
            <ItemList>
              {data.trendFlags.map((flag) => (
                <li key={flag.id}>
                  <strong>{safeText(flag.title) || 'Trend flag'}</strong> · {formatEnumLabel(flag.flag_type)} · {formatEnumLabel(flag.status)} · {formatEnumLabel(flag.severity)}
                  <DetailLine value={`First detected: ${formatDate(flag.first_detected_at)}`} />
                  <DetailLine value={linkedLabel(flag, lookups)} />
                  <DetailLine value={safeText(flag.description)} />
                </li>
              ))}
            </ItemList>
          )}
        </SectionShell>
      ) : null}

      {selectedSections.has('documents_summary') ? (
        <SectionShell title="Documents summary">
          {data.documents.length === 0 ? (
            <EmptySection label="Documents" />
          ) : (
            <ItemList>
              {data.documents.map((document) => (
                <li key={document.id}>
                  <strong>{safeText(document.title) || 'Document'}</strong> · {formatEnumLabel(document.document_type)}
                  <DetailLine value={`Linked to: ${linkedLabel(document, lookups)}`} />
                  <DetailLine value={`Created: ${formatDate(document.created_at)}`} />
                  <DetailLine value={safeFileName(document.file_name) ? `File: ${safeFileName(document.file_name)}` : 'File name hidden by privacy rule'} />
                </li>
              ))}
            </ItemList>
          )}
        </SectionShell>
      ) : null}

      {selectedSections.has('receipts_summary') ? (
        <SectionShell title="Receipts summary">
          {approvedReceipts.length === 0 ? (
            <EmptySection label="Approved receipts" />
          ) : (
            <ItemList>
              {approvedReceipts.map((receipt) => (
                <li key={receipt.id}>
                  <strong>{safeText(receipt.vendor_name) || safeText(receipt.description) || 'Receipt'}</strong> · {formatEnumLabel(receipt.category)}
                  <DetailLine value={`Date: ${formatDate(receipt.purchase_date || receipt.created_at)}`} />
                  <DetailLine value={`Linked to: ${linkedLabel(receipt, lookups)}`} />
                  {showReceiptAmounts ? <DetailLine value={`Amount: ${formatAmount(receipt.total_amount, receipt.currency)}`} /> : null}
                </li>
              ))}
            </ItemList>
          )}
        </SectionShell>
      ) : null}
    </article>
  );
}

function ItemList({ children }: { children: React.ReactNode }) {
  return <ul style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 10, lineHeight: 1.5 }}>{children}</ul>;
}

function DetailLine({ value }: { value: string | null | undefined }) {
  if (!value) {
    return null;
  }

  return <div style={{ color: '#4b5563', fontSize: '0.93rem', marginTop: 2 }}>{value}</div>;
}
