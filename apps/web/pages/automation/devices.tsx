import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AUTOMATION_DEVICE_CATEGORIES,
  AUTOMATION_PROTOCOLS,
  AUTOMATION_STATUS_LABELS,
  formatEnumLabel,
  sortEnumForDisplay,
  type AutomationDeviceCategory,
  type AutomationProtocol
} from '@home-folder/shared';
import { Button, Card, EmptyState, Input, PageHeader, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import {
  createDeviceForContext,
  getAutomationContext,
  getDevicesForContext,
  type AutomationDataContext,
  type AutomationDataMode,
  type AutomationDeviceRow
} from '../../lib/automation';
import { getDemoRooms } from '../../lib/demoStorage';
import {
  getAvailableLocationPresets,
  isLocationPresetValue,
  resolveLocationRoomId,
  rollbackCreatedLocation
} from '../../lib/locationPresets';
import { getRoomsForProperty } from '../../lib/rooms';
import { formatRoomLocation } from '../../lib/roomLabels';

type Room = { id: string; name: string; room_type?: string | null; floor_name?: string | null };

function statusTone(status: AutomationDeviceRow['status']): 'good' | 'urgent' | 'attention' | 'neutral' {
  if (status === 'online') return 'good';
  if (status === 'offline') return 'urgent';
  if (status === 'needs_attention' || status === 'intermittent' || status === 'low_battery') return 'attention';
  return 'neutral';
}

export default function AutomationDevicesPage() {
  const [context, setContext] = useState<AutomationDataContext | null>(null);
  const [dataMode, setDataMode] = useState<AutomationDataMode>('demo');
  const [devices, setDevices] = useState<AutomationDeviceRow[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // quick add
  const [qName, setQName] = useState('');
  const [qCategory, setQCategory] = useState<AutomationDeviceCategory>('other');
  const [qRoom, setQRoom] = useState('');
  const [qProtocol, setQProtocol] = useState<AutomationProtocol | ''>('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const nextContext = await getAutomationContext();
        const [nextDevices, roomList] =
          nextContext.mode === 'supabase' && nextContext.property
            ? await Promise.all([getDevicesForContext(nextContext), getRoomsForProperty(nextContext.property.id)])
            : [await getDevicesForContext(nextContext), getDemoRooms()];
        if (!isMounted) return;
        setContext(nextContext);
        setDataMode(nextContext.mode);
        setDevices(nextDevices);
        setRooms(roomList as Room[]);
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load devices.');
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
  }, []);

  const roomNames = useMemo(() => new Map(rooms.map((room) => [room.id, formatRoomLocation(room)])), [rooms]);
  const locationPresets = useMemo(() => getAvailableLocationPresets(rooms), [rooms]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return devices
      .filter((d) => (categoryFilter ? d.category === categoryFilter : true))
      .filter((d) => (statusFilter ? d.status === statusFilter : true))
      .filter((d) => {
        if (!term) return true;
        return [d.name, d.nickname, d.manufacturer, d.model, d.serial_number]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      });
  }, [devices, categoryFilter, statusFilter, search]);

  const handleQuickAdd = async () => {
    if (!context) return;
    if (!qName.trim()) {
      setFormError('Give the device a name first.');
      return;
    }
    if (isLocationPresetValue(qRoom) && (context.mode !== 'supabase' || !context.property)) {
      setFormError('Create a property before adding a new location.');
      return;
    }
    setSaving(true);
    setFormError('');

    const resolutionContext =
      context.mode === 'supabase' && context.property
        ? ({ mode: 'supabase', propertyId: context.property.id } as const)
        : ({ mode: 'demo' } as const);

    let createdRoomId: string | null = null;

    try {
      const wasPreset = isLocationPresetValue(qRoom);
      const resolved = await resolveLocationRoomId(qRoom, resolutionContext);
      createdRoomId = resolved.createdRoomId;

      const created = await createDeviceForContext(context, {
        name: qName.trim(),
        category: qCategory,
        status: 'unknown',
        is_critical: false,
        internet_required: false,
        local_control_available: true,
        room_id: resolved.roomId,
        primary_protocol: qProtocol || null
      });
      setDevices((current) => [created, ...current].sort((a, b) => a.name.localeCompare(b.name)));
      if (wasPreset && context.mode === 'supabase' && context.property) {
        setRooms((await getRoomsForProperty(context.property.id)) as Room[]);
        setQRoom(created.room_id || '');
      }
      setQName('');
      setQProtocol('');
    } catch (saveError) {
      // The new location is created before the device row. If the device fails
      // to save, take the location back out instead of leaving an empty space
      // behind on the home map.
      await rollbackCreatedLocation(createdRoomId, resolutionContext);
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to add device.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Smart Home" title="Devices" description="Every connected device in the home.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ActionLink href="/automation/add-device">Add device</ActionLink>
          <ActionLink href="/automation" variant="secondary">Smart home overview</ActionLink>
          <ActionLink href="/dashboard" variant="secondary">Back to dashboard</ActionLink>
        </div>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        {dataMode === 'supabase' ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Quick add</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Name it and shelve it — add the details later from its record.</p>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'end' }}>
              <label>
                <span>Device name</span>
                <Input value={qName} onChange={(e) => setQName(e.target.value)} placeholder="Front door lock" style={{ marginTop: 6 }} />
              </label>
              <label>
                <span>Type</span>
                <Select value={qCategory} onChange={(e) => setQCategory(e.target.value as AutomationDeviceCategory)} style={{ marginTop: 6 }}>
                  {sortEnumForDisplay(AUTOMATION_DEVICE_CATEGORIES).map((c) => (
                    <option key={c} value={c}>{formatEnumLabel(c)}</option>
                  ))}
                </Select>
              </label>
              <label>
                <span>Room</span>
                <Select value={qRoom} onChange={(e) => setQRoom(e.target.value)} style={{ marginTop: 6 }}>
                  <option value="">No room yet</option>
                  {rooms.length > 0 ? (
                    <optgroup label="Rooms & spaces">
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>{formatRoomLocation(room)}</option>
                      ))}
                    </optgroup>
                  ) : null}
                  {locationPresets.length > 0 ? (
                    <optgroup label="Outdoor & exterior">
                      {locationPresets.map((preset) => (
                        <option key={preset.value} value={preset.value}>{preset.label}</option>
                      ))}
                    </optgroup>
                  ) : null}
                </Select>
              </label>
              <label>
                <span>Connects via</span>
                <Select value={qProtocol} onChange={(e) => setQProtocol(e.target.value as AutomationProtocol | '')} style={{ marginTop: 6 }}>
                  <option value="">Unknown</option>
                  {sortEnumForDisplay(AUTOMATION_PROTOCOLS).map((p) => (
                    <option key={p} value={p}>{formatEnumLabel(p)}</option>
                  ))}
                </Select>
              </label>
              <Button onClick={handleQuickAdd} disabled={saving}>{saving ? 'Adding…' : 'Add device'}</Button>
            </div>
            {formError ? <p style={{ color: 'var(--status-urgent)', fontWeight: 700, marginBottom: 0 }}>{formError}</p> : null}
          </Card>
        ) : null}

        <Card>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
            <label style={{ flex: '1 1 200px' }}>
              <span>Search</span>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="lock, camera, serial…" style={{ marginTop: 6 }} />
            </label>
            <label style={{ flex: '0 1 180px' }}>
              <span>Type</span>
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ marginTop: 6 }}>
                <option value="">All types</option>
                {sortEnumForDisplay(AUTOMATION_DEVICE_CATEGORIES).map((c) => (
                  <option key={c} value={c}>{formatEnumLabel(c)}</option>
                ))}
              </Select>
            </label>
            <label style={{ flex: '0 1 180px' }}>
              <span>Status</span>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ marginTop: 6 }}>
                <option value="">Any status</option>
                {Object.entries(AUTOMATION_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </label>
          </div>
        </Card>

        {error ? <Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>{error}</p></Card> : null}

        {loading ? (
          <Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading devices…</p></Card>
        ) : dataMode === 'demo' ? (
          <EmptyState title="Sign in to record devices" description="Automation data saves to your account so it's available during an emergency or handover." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No devices match" description="Try clearing the filters, or add your first device above." />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.map((device) => (
              <Card key={device.id} interactive style={{ padding: '14px 14px 14px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
                      <Link href={`/automation/devices/${device.id}`} style={{ textDecoration: 'none' }}>
                        {device.nickname || device.name}
                      </Link>
                    </strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 2 }}>
                      {[formatEnumLabel(device.category), device.manufacturer, device.room_id ? roomNames.get(device.room_id) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <UtilityBadge label={AUTOMATION_STATUS_LABELS[device.status]} tone={statusTone(device.status)} />
                    {device.is_critical ? <UtilityBadge label="Critical" tone="attention" /> : null}
                    {device.internet_required ? <UtilityBadge label="Needs internet" /> : <UtilityBadge label="Works locally" tone="good" />}
                    <ActionLink href={`/automation/devices/${device.id}`} variant="secondary">Open</ActionLink>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
