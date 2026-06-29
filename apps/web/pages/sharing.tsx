import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { Button, Card, PageHeader, UtilityBadge } from '@home-bible/ui';
import {
  loadSharingPreview,
  SHARING_ROLES,
  sharingSectionLabel,
  type SharingPreview,
  type SharingRole
} from '../lib/sharing';

type Linkable = {
  room_id?: string | null;
  asset_id?: string | null;
  utility_id?: string | null;
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

const subtleText = { color: '#6b7280' };

const roleCopy: Record<SharingRole, string> = {
  owner: 'Planning preview for current owner-level safe access.',
  co_owner: 'Planning preview for broad co-owner safe access.',
  editor: 'Planning preview for editing-capable safe access.',
  viewer: 'Planning preview for read-only safe access.',
  maintenance_guest: 'Planning preview for scoped maintenance access.',
  buyer_preview: 'Planning preview for safe buyer handoff access.',
  insurance_view: 'Planning preview for insurance-oriented metadata access.'
};

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

function safeText(value: string | null | undefined, fallback = 'Hidden by privacy rule') {
  if (!value || !value.trim()) return null;
  return forbiddenSensitivePatterns.some((pattern) => pattern.test(value)) ? fallback : value.trim();
}

function safeFileName(value: string | null | undefined) {
  const fileName = safeText(value);
  if (!fileName || /^https?:\/\//i.test(fileName) || /^www\./i.test(fileName)) return null;
  return fileName;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatAmount(amount: number | null, currency: string) {
  if (amount === null) return 'Hidden';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    return `${currency || 'USD'} ${amount.toFixed(2)}`;
  }
}

function buildLookups(preview: SharingPreview) {
  return {
    rooms: new Map(preview.data.rooms.map((room) => [room.id, room.name])),
    assets: new Map(preview.data.assets.map((asset) => [asset.id, asset.name])),
    utilities: new Map(preview.data.utilities.map((utility) => [utility.id, utility.name])),
    repairs: new Map(preview.data.repairs.map((repair) => [repair.id, repair.title])),
    serviceRecords: new Map(preview.data.serviceRecords.map((record) => [record.id, record.service_title])),
    issues: new Map(preview.data.issues.map((issue) => [issue.id, issue.title])),
    trendFlags: new Map(preview.data.trendFlags.map((flag) => [flag.id, flag.title]))
  };
}

function linkedLabel(record: Linkable, lookups: ReturnType<typeof buildLookups>) {
  if (record.room_id) return lookups.rooms.get(record.room_id) || 'Room record';
  if (record.asset_id) return lookups.assets.get(record.asset_id) || 'Asset record';
  if (record.utility_id) return lookups.utilities.get(record.utility_id) || 'Utility record';
  if (record.repair_id) return lookups.repairs.get(record.repair_id) || 'Repair record';
  if (record.service_record_id) return lookups.serviceRecords.get(record.service_record_id) || 'Service record';
  if (record.issue_id) return lookups.issues.get(record.issue_id) || 'Issue record';
  if (record.trend_flag_id) return lookups.trendFlags.get(record.trend_flag_id) || 'Trend flag record';
  return 'Property';
}

function roleLabel(role: SharingRole) {
  return role === 'co_owner' ? 'Co-owner' : formatEnumLabel(role);
}

export default function SharingPage() {
  const [selectedRole, setSelectedRole] = useState<SharingRole>('owner');
  const [preview, setPreview] = useState<SharingPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadPreview() {
      setLoading(true);
      setError('');

      try {
        const nextPreview = await loadSharingPreview(selectedRole);
        if (isMounted) {
          setPreview(nextPreview);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load sharing preview.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [selectedRole]);

  const modeLabel = preview?.mode === 'supabase' ? 'Saved to your account.' : 'Demo data is stored only in this browser.';

  return (
    <>
      <PageHeader
        title="Sharing & Access Review"
        description="Preview what different roles could see before real sharing, invitations, or guest access are enabled."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <UtilityBadge label={modeLabel} />
            {preview?.propertyName ? <UtilityBadge label={preview.propertyName} /> : null}
            <UtilityBadge label="Preview only" />
          </div>

          <p style={{ ...subtleText, marginTop: 0 }}>
            This phase only previews access. It does not create public links, send emails, add guests, or create background jobs.
          </p>
          <p style={{ ...subtleText, marginTop: 0 }}>
            Privacy reminder: sensitive entry details, passwords, private file paths, signed file links, invite credentials, and public sharing links are not included.
          </p>

          {loading ? <p style={subtleText}>Loading sharing preview...</p> : null}
          {error ? <p style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</p> : null}

          {!loading && preview && !preview.propertyName ? (
            <div style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 12, padding: 14 }}>
              <strong>No property found yet.</strong>
              <p style={{ ...subtleText, marginBottom: 0 }}>
                {preview.mode === 'supabase'
                  ? 'Create or join a property before reviewing access.'
                  : 'Demo data is stored only in this browser. Add a demo property and rooms first to preview sample access.'}
              </p>
            </div>
          ) : null}
        </Card>

        <Card>
          <label style={{ display: 'grid', gap: 6, maxWidth: 360 }}>
            <span style={{ fontWeight: 700 }}>Role to preview</span>
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as SharingRole)}
              style={fieldStyle}
            >
              {SHARING_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </label>
          <p style={{ ...subtleText, marginBottom: 0 }}>{roleCopy[selectedRole]}</p>
        </Card>

        {preview ? <SharingPreviewPanel preview={preview} /> : null}
      </div>
    </>
  );
}

function SharingPreviewPanel({ preview }: { preview: SharingPreview }) {
  const lookups = useMemo(() => buildLookups(preview), [preview]);
  const activeReceipts = preview.data.receipts.filter((receipt) => receipt.approval_status === 'approved').slice(0, 5);
  const documents = preview.data.documents.slice(0, 5);
  const visibleCounts = {
    rooms: preview.data.rooms.length,
    utilities: preview.data.utilities.length,
    assets: preview.data.assets.length,
    reminders: preview.data.reminders.length,
    repairs: preview.data.repairs.length,
    serviceRecords: preview.data.serviceRecords.length,
    issues: preview.data.issues.length,
    trendFlags: preview.data.trendFlags.length,
    documents: preview.data.documents.length,
    receipts: activeReceipts.length
  };

  return (
    <>
      <Card>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div>
            <h2 style={{ marginTop: 0 }}>{preview.label}</h2>
            <p style={subtleText}>{preview.summary}</p>
            {preview.warning ? (
              <div style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 12, padding: 12 }}>
                <strong>{preview.warning}</strong>
              </div>
            ) : null}
          </div>

          <div>
            <h3 style={{ marginTop: 0 }}>Permission summary</h3>
            <PreviewRow label="Files" value={preview.fileBehavior} />
            <PreviewRow label="Receipts" value={preview.receiptBehavior} />
            <PreviewRow label="Financial details" value={preview.financialDetailsBehavior} />
            <PreviewRow label="Edits" value={preview.editBehavior} />
            <PreviewRow label="Deletes" value={preview.deleteBehavior} />
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>This role can see</h2>
          <PlainList items={preview.canSee} />
        </Card>
        <Card>
          <h2 style={{ marginTop: 0 }}>This role cannot see</h2>
          <PlainList items={preview.cannotSee} />
        </Card>
      </div>

      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>Visible sections</h2>
          <PlainList items={preview.visibleSections} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {preview.data.sections.map((section) => (
              <UtilityBadge key={section} label={sharingSectionLabel(section)} />
            ))}
          </div>
        </Card>
        <Card>
          <h2 style={{ marginTop: 0 }}>Hidden sections</h2>
          <PlainList items={preview.hiddenSections} />
        </Card>
      </div>

      <Card>
        <h2 style={{ marginTop: 0 }}>Sample scoped preview</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <UtilityBadge label={`${visibleCounts.rooms} rooms`} />
          <UtilityBadge label={`${visibleCounts.utilities} utilities`} />
          <UtilityBadge label={`${visibleCounts.assets} assets`} />
          <UtilityBadge label={`${visibleCounts.repairs} repairs`} />
          <UtilityBadge label={`${visibleCounts.issues} issues`} />
          <UtilityBadge label={`${visibleCounts.documents} document metadata`} />
          <UtilityBadge label={`${visibleCounts.receipts} approved receipts`} />
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <PreviewDataSection title="Rooms" hidden={preview.role === 'maintenance_guest'} emptyLabel="No rooms visible for this role.">
            <RecordList
              items={preview.data.rooms.slice(0, 6).map((room) => `${safeText(room.name) || 'Room'} · ${formatEnumLabel(room.room_type)} · ${safeText(room.floor_name) || 'Unassigned'}`)}
            />
          </PreviewDataSection>

          <PreviewDataSection title="Utilities" emptyLabel="No utilities visible for this role.">
            <RecordList
              items={preview.data.utilities.slice(0, 6).map((utility) => {
                const location = safeText(utility.location_notes) || linkedLabel(utility, lookups);
                return `${safeText(utility.name) || 'Utility'} · ${formatEnumLabel(utility.utility_type)} · ${location}`;
              })}
            />
          </PreviewDataSection>

          <PreviewDataSection title="Assets" emptyLabel="No assets visible for this role.">
            <RecordList
              items={preview.data.assets.slice(0, 6).map((asset) =>
                [
                  safeText(asset.name) || 'Asset',
                  formatEnumLabel(asset.asset_type),
                  linkedLabel(asset, lookups),
                  [safeText(asset.brand), safeText(asset.model)].filter(Boolean).join(' ')
                ].filter(Boolean).join(' · ')
              )}
            />
          </PreviewDataSection>

          <PreviewDataSection title="Repairs and service history" emptyLabel="No repairs or service history visible for this role.">
            <RecordList
              items={[
                ...preview.data.repairs.slice(0, 4).map((repair) =>
                  `${safeText(repair.title) || 'Repair'} · ${formatEnumLabel(repair.status)} · ${linkedLabel(repair, lookups)}`
                ),
                ...preview.data.serviceRecords.slice(0, 4).map((record) =>
                  `${safeText(record.service_title) || 'Service record'} · ${formatDate(record.service_date)} · ${linkedLabel(record, lookups)}`
                )
              ]}
            />
          </PreviewDataSection>

          <PreviewDataSection title="Issues and trends" emptyLabel="No issues or trends visible for this role.">
            <RecordList
              items={[
                ...preview.data.issues.slice(0, 4).map((issue) =>
                  `${safeText(issue.title) || 'Issue'} · ${formatEnumLabel(issue.severity)} · ${formatEnumLabel(issue.status)} · ${linkedLabel(issue, lookups)}`
                ),
                ...preview.data.trendFlags.slice(0, 4).map((flag) =>
                  `${safeText(flag.title) || 'Trend flag'} · ${formatEnumLabel(flag.status)} · ${formatEnumLabel(flag.severity)}`
                )
              ]}
            />
          </PreviewDataSection>

          <PreviewDataSection title="Documents metadata" hidden={documents.length === 0 && preview.role === 'maintenance_guest'} emptyLabel="No document metadata visible for this role.">
            <RecordList
              items={documents.map((document) =>
                [
                  safeText(document.title) || 'Document',
                  formatEnumLabel(document.document_type),
                  `Linked to ${linkedLabel(document, lookups)}`,
                  `File ${safeFileName(document.file_name) || 'hidden by privacy rule'}`
                ].join(' · ')
              )}
            />
          </PreviewDataSection>

          <PreviewDataSection title="Receipts metadata" hidden={preview.role === 'maintenance_guest' || preview.role === 'buyer_preview'} emptyLabel="No receipt metadata visible for this role.">
            <RecordList
              items={activeReceipts.map((receipt) => {
                const amount = preview.receiptAmountsVisible ? formatAmount(receipt.total_amount, receipt.currency) : 'Hidden';
                return `${safeText(receipt.vendor_name) || safeText(receipt.description) || 'Receipt'} · ${formatDate(receipt.purchase_date || receipt.created_at)} · ${formatEnumLabel(receipt.category)} · Amount: ${amount}`;
              })}
            />
          </PreviewDataSection>
        </div>
      </Card>
    </>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <strong>{label}:</strong> <span style={subtleText}>{value}</span>
    </div>
  );
}

function PlainList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function PreviewDataSection({
  title,
  hidden,
  emptyLabel,
  children
}: {
  title: string;
  hidden?: boolean;
  emptyLabel: string;
  children: ReactNode;
}) {
  if (hidden) {
    return (
      <section style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <p style={subtleText}>{emptyLabel}</p>
      </section>
    );
  }

  return (
    <section style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      {children}
    </section>
  );
}

function RecordList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p style={subtleText}>No visible records in this sample.</p>;
  }

  return (
    <ul style={{ marginBottom: 0, paddingLeft: 20, lineHeight: 1.7 }}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
