import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-folder/shared';
import { Button, Card, getControlStyle, Input, PageHeader, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../../components/ActionLink';
import { getAssetsForProperty, getDemoAssets, type AssetRow } from '../../../lib/assets';
import { getDemoRooms } from '../../../lib/demoStorage';
import { getPropertyAddressLine } from '../../../lib/properties';
import {
  getRepairByIdForContext,
  getRepairDataContext,
  type RepairDataContext,
  type RepairRow
} from '../../../lib/repairs';
import { formatRoomLocation, formatRoomTypeLabel } from '../../../lib/roomLabels';
import { getRoomsForProperty } from '../../../lib/rooms';
import {
  getServiceRecordDataContext,
  getServiceRecordsForContext,
  type ServiceRecordRow
} from '../../../lib/serviceRecords';
import {
  buildServiceCallEmail,
  buildServiceCallSheet,
  formatFriendlyDate,
  sanitizePhoneForHref,
  serviceCallToCompactText,
  serviceCallToPlainText,
  type ServiceCallSheet
} from '../../../lib/serviceCall';
import { getDemoUtilities, getUtilitiesForProperty, type UtilityRow } from '../../../lib/utilities';

type NamedRow = { id: string; name: string };
type RoomRowLite = { id: string; name: string; room_type?: string | null; floor_name?: string | null };

export default function ServiceCallSheetPage() {
  const router = useRouter();
  const { id } = router.query;
  const repairId = typeof id === 'string' ? id : '';

  const [context, setContext] = useState<RepairDataContext | null>(null);
  const [repair, setRepair] = useState<RepairRow | null>(null);
  const [utilities, setUtilities] = useState<UtilityRow[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
  const [rooms, setRooms] = useState<RoomRowLite[]>([]);
  const [assets, setAssets] = useState<NamedRow[]>([]);
  const [propertyAddress, setPropertyAddress] = useState<string | null>(null);
  const [propertyName, setPropertyName] = useState('Home');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareNote, setShareNote] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!repairId) return;
      setLoading(true);
      setError('');

      try {
        const [repairContext, serviceContext] = await Promise.all([
          getRepairDataContext(),
          getServiceRecordDataContext()
        ]);

        const nextRepair = await getRepairByIdForContext(repairContext, repairId);

        let nextUtilities: UtilityRow[] = [];
        let nextRooms: RoomRowLite[] = [];
        let nextAssets: NamedRow[] = [];
        let nextAddress: string | null = null;

        if (repairContext.mode === 'supabase' && repairContext.property) {
          const propertyId = repairContext.property.id;
          const [util, roomList, assetList, address] = await Promise.all([
            getUtilitiesForProperty(propertyId),
            getRoomsForProperty(propertyId),
            getAssetsForProperty(propertyId),
            getPropertyAddressLine(propertyId)
          ]);
          nextUtilities = util;
          nextRooms = roomList.map((room) => ({
            id: room.id,
            name: room.name,
            room_type: room.room_type,
            floor_name: room.floor_name
          }));
          nextAssets = assetList.map((asset) => ({ id: asset.id, name: asset.name }));
          nextAddress = address;
        } else {
          nextUtilities = getDemoUtilities();
          nextRooms = getDemoRooms().map((room) => ({
            id: room.id,
            name: room.name,
            room_type: room.room_type,
            floor_name: room.floor_name
          }));
          nextAssets = getDemoAssets().map((asset: AssetRow) => ({ id: asset.id, name: asset.name }));
        }

        const nextServiceRecords = await getServiceRecordsForContext(serviceContext);

        if (!isMounted) return;

        setContext(repairContext);
        setRepair(nextRepair);
        setUtilities(nextUtilities);
        setServiceRecords(nextServiceRecords);
        setRooms(nextRooms);
        setAssets(nextAssets);
        setPropertyAddress(nextAddress);
        setPropertyName(repairContext.property?.nickname || 'Home');
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to build the service call sheet.');
        }
      } finally {
        if (isMounted) setLoading(false);
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
  }, [repairId]);

  const locationLabel = useMemo(() => {
    if (!repair) return null;
    if (repair.room_id) {
      const room = rooms.find((candidate) => candidate.id === repair.room_id);
      if (!room) return null;
      const typeLabel = room.room_type ? formatRoomTypeLabel(room.room_type) : null;
      const base = formatRoomLocation(room);
      return typeLabel && typeLabel.toLowerCase() !== room.name.trim().toLowerCase()
        ? `${base} (${typeLabel})`
        : base;
    }
    if (repair.asset_id) return assets.find((asset) => asset.id === repair.asset_id)?.name || null;
    if (repair.utility_id) return utilities.find((utility) => utility.id === repair.utility_id)?.name || null;
    return null;
  }, [repair, rooms, assets, utilities]);

  // Lets a shut-off's assigned room stand in as its location on the sheet.
  const roomLabelFor = useCallback(
    (roomId: string) => {
      const room = rooms.find((candidate) => candidate.id === roomId);
      return room ? formatRoomLocation(room) : null;
    },
    [rooms]
  );

  const sheet: ServiceCallSheet | null = useMemo(() => {
    if (!repair) return null;
    return buildServiceCallSheet({
      repair,
      utilities,
      serviceRecords,
      propertyName,
      propertyAddress,
      locationLabel,
      onSiteContact: { name: contactName, phone: contactPhone },
      typeLabelFor: formatEnumLabel,
      roomLabelFor
    });
  }, [repair, utilities, serviceRecords, propertyName, propertyAddress, locationLabel, contactName, contactPhone, roomLabelFor]);

  const plainText = useMemo(() => (sheet ? serviceCallToPlainText(sheet) : ''), [sheet]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setShareNote('');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setShareNote('Could not copy automatically — select the text below to copy it.');
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: sheet ? `Repair: ${sheet.issueTitle}` : 'Home repair',
          text: plainText
        });
        setShareNote('');
      } catch {
        /* user cancelled — ignore */
      }
    } else {
      setShareNote('Sharing is not supported on this device. Use Copy or Text instead.');
    }
  };

  const compactText = useMemo(() => (sheet ? serviceCallToCompactText(sheet) : ''), [sheet]);

  // Pre-address the text and email to the technician when their contact info
  // is on the repair; otherwise the links open with just the body filled in.
  const contractorPhone = sanitizePhoneForHref(repair?.contractor_phone);
  const contractorEmail = repair?.contractor_email?.trim() || '';
  const smsHref = `sms:${contractorPhone || ''}?&body=${encodeURIComponent(compactText)}`;
  const email = sheet ? buildServiceCallEmail(sheet) : null;
  const mailtoHref = email
    ? `mailto:${encodeURIComponent(contractorEmail)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`
    : '#';

  if (loading) {
    return (
      <>
        <PageHeader title="Service call sheet" />
        <Card>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Assembling the sheet…</p>
        </Card>
      </>
    );
  }

  if (error || !repair || !sheet) {
    return (
      <>
        <PageHeader title={error ? 'Could not build the sheet' : 'Repair not found'} />
        <Card>
          {error ? <p style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p> : null}
          <p style={{ color: 'var(--text-muted)' }}>
            This repair may not exist yet, or the sheet could not be assembled.
          </p>
          <ActionLink href="/repairs" variant="secondary">Back to repairs</ActionLink>
        </Card>
      </>
    );
  }

  return (
    <>
      {/* Controls — hidden when printing */}
      <div className="print-hide">
        <PageHeader
          eyebrow="Section IV — Care & Maintenance"
          title="Service call sheet"
          description="A clear, printable summary anyone at home can hand or text to a repair professional — even if they don't know the technical details."
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button onClick={() => window.print()}>Print</Button>
            <a href={smsHref} className="action-link hb-control" style={getControlStyle({ variant: 'secondary' })}>
              {contractorPhone ? 'Text the technician' : 'Text this'}
            </a>
            <a href={mailtoHref} className="action-link hb-control" style={getControlStyle({ variant: 'secondary' })}>
              {contractorEmail ? 'Email the technician' : 'Email this'}
            </a>
            <Button variant="secondary" onClick={handleShare}>Share…</Button>
            <Button variant="secondary" onClick={handleCopy}>{copied ? 'Copied ✓' : 'Copy text'}</Button>
            <ActionLink href={`/repairs/${repair.id}`} variant="secondary">Back to repair</ActionLink>
          </div>
        </PageHeader>

        <Card style={{ marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Who is home for the visit?</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Optional. Add the person who will meet the technician — a spouse, a renter, a neighbor.
            It's included on the sheet so the pro knows who to coordinate with.
          </p>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <label>
              <span>Name</span>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Alex (spouse)" style={{ marginTop: 6 }} />
            </label>
            <label>
              <span>Phone</span>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(555) 010-2020" style={{ marginTop: 6 }} />
            </label>
          </div>
          {shareNote ? (
            <p style={{ color: 'var(--status-attention)', marginBottom: 0, fontWeight: 600 }}>{shareNote}</p>
          ) : null}
          {context?.mode === 'supabase' && !sheet.propertyAddress ? (
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
              No address is on this sheet.{' '}
              <Link href="/settings" style={{ textDecoration: 'underline', fontWeight: 600 }}>
                Add it in Settings — and tick &ldquo;include this address&rdquo;
              </Link>
              , which is off by default, so the technician knows where to go.
            </p>
          ) : null}
        </Card>
      </div>

      {/* The sheet itself — this is what prints */}
      <article
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: 28
        }}
      >
        <header style={{ borderBottom: '2px solid var(--color-espresso)', paddingBottom: 16, marginBottom: 18 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--color-brass-deep)'
            }}
          >
            Home repair · Service call sheet
          </div>
          <h1 style={{ margin: '6px 0 4px', fontSize: 30, lineHeight: 1.08 }}>{sheet.issueTitle}</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            {sheet.propertyName}
            {sheet.propertyAddress ? ` · ${sheet.propertyAddress}` : ''}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <UtilityBadge label={sheet.issueTypeLabel} />
            <UtilityBadge label={`Priority: ${sheet.priorityLabel}`} tone={repair.priority === 'urgent' || repair.priority === 'high' ? 'urgent' : 'neutral'} />
            {sheet.locationLabel ? <UtilityBadge label={`Location: ${sheet.locationLabel}`} /> : null}
            {sheet.reportedDate ? <UtilityBadge label={`Reported ${formatFriendlyDate(sheet.reportedDate)}`} /> : null}
          </div>
        </header>

        {sheet.scheduledVisit ? (
          <section style={{ marginBottom: 20 }}>
            <h2 style={{ marginTop: 0 }}>Scheduled visit</h2>
            <p style={{ marginBottom: 0 }}>
              <strong>
                {[sheet.scheduledVisit.dateLabel, sheet.scheduledVisit.window].filter(Boolean).join(' · ')}
              </strong>
              {sheet.contractor?.name ? ` — ${sheet.contractor.name}` : ''}
            </p>
          </section>
        ) : null}

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>What we are seeing</h2>
          {sheet.description ? (
            <p style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{sheet.description}</p>
          ) : (
            <p style={{ marginBottom: 0, color: 'var(--text-muted)' }}>
              No description recorded. The person on site can describe the problem on arrival.
            </p>
          )}
        </section>

        {sheet.onSiteContact ? (
          <section style={{ marginBottom: 20 }}>
            <h2 style={{ marginTop: 0 }}>Who is home</h2>
            <p style={{ marginBottom: 0 }}>
              <strong>{sheet.onSiteContact.name}</strong>
              {sheet.onSiteContact.phone ? ` · ${sheet.onSiteContact.phone}` : ''}
            </p>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
              They may not know the technical details — the information below should help.
            </p>
          </section>
        ) : null}

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>Shut-offs &amp; key locations</h2>
          <p style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: 14 }}>
            Relevant to a {sheet.issueTypeLabel.toLowerCase()} issue. In an emergency, shut off the
            water, gas, or power at the locations below.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {sheet.safety.map((item, index) => (
              <div
                key={`${item.utilityType}-${index}`}
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderLeft: `3px solid ${item.recorded ? 'var(--color-brass)' : 'var(--border-strong)'}`,
                  borderRadius: 4,
                  padding: '10px 14px'
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {item.typeLabel}
                  {item.name ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> — {item.name}</span> : null}
                </div>
                {item.recorded ? (
                  <>
                    <div style={{ marginTop: 2 }}>
                      {item.location || <span style={{ color: 'var(--text-muted)' }}>Location not written down.</span>}
                    </div>
                    {item.emergencyNotes ? (
                      <div style={{ marginTop: 4, color: 'var(--status-urgent)', fontSize: 14 }}>
                        ⚠ {item.emergencyNotes}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div style={{ marginTop: 2, color: 'var(--text-muted)' }}>
                    Not on file — please ask the homeowner on arrival.
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {sheet.serviceHistory.length > 0 ? (
          <section style={{ marginBottom: 20 }}>
            <h2 style={{ marginTop: 0 }}>Relevant service history</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {sheet.serviceHistory.map((record, index) => (
                <div key={index} style={{ border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '10px 14px' }}>
                  <div style={{ fontWeight: 700 }}>{record.title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                    {[formatFriendlyDate(record.date), record.provider].filter(Boolean).join(' · ') || '—'}
                  </div>
                  {record.summary ? <div style={{ marginTop: 4 }}>{record.summary}</div> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {sheet.contractor ? (
          <section style={{ marginBottom: 20 }}>
            <h2 style={{ marginTop: 0 }}>Preferred contractor</h2>
            <p style={{ marginBottom: 0 }}>
              {[sheet.contractor.name, sheet.contractor.phone, sheet.contractor.email].filter(Boolean).join(' · ') || 'On file'}
            </p>
          </section>
        ) : null}

        <footer style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 8, color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          Shared from Our Home Folder · Sensitive codes and passwords are intentionally omitted.
        </footer>
      </article>

      {/* plain-text preview for manual copy fallback */}
      <div className="print-hide">
        <Card style={{ marginTop: 24 }}>
          <h2 style={{ marginTop: 0 }}>Text version</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
            This is exactly what gets copied or texted. Select and copy if the buttons don't work on your device.
          </p>
          <textarea
            readOnly
            value={plainText}
            style={{
              width: '100%',
              minHeight: 220,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              lineHeight: 1.5,
              padding: 12,
              resize: 'vertical'
            }}
          />
        </Card>
      </div>
    </>
  );
}
