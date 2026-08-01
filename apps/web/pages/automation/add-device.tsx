import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import {
  AUTOMATION_DEVICE_CATEGORIES,
  AUTOMATION_ECOSYSTEMS,
  AUTOMATION_POWER_TYPES,
  AUTOMATION_PROTOCOLS,
  formatEnumLabel,
  type AutomationDeviceCategory,
  type AutomationEcosystem,
  type AutomationPowerType,
  type AutomationProtocol
} from '@home-folder/shared';
import { Button, Card, Input, PageHeader, Select } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import {
  createDeviceForContext,
  getAutomationContext,
  getHubsForContext,
  getNetworksForContext,
  type AutomationDataContext,
  type AutomationHubRow,
  type AutomationNetworkRow
} from '../../lib/automation';
import {
  getAvailableLocationPresets,
  isLocationPresetValue,
  resolveLocationRoomId,
  rollbackCreatedLocation
} from '../../lib/locationPresets';
import { getRoomsForProperty } from '../../lib/rooms';
import { formatRoomLocation } from '../../lib/roomLabels';

type Room = { id: string; name: string; room_type?: string | null; floor_name?: string | null };

const STEPS = ['Identity', 'Location', 'How it connects', 'Power', 'Setup & recovery', 'Review'];

export default function GuidedAddDevicePage() {
  const router = useRouter();
  const [context, setContext] = useState<AutomationDataContext | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [hubs, setHubs] = useState<AutomationHubRow[]>([]);
  const [networks, setNetworks] = useState<AutomationNetworkRow[]>([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notReady, setNotReady] = useState('');

  const [form, setForm] = useState({
    name: '',
    nickname: '',
    category: 'other' as AutomationDeviceCategory,
    manufacturer: '',
    model: '',
    serial_number: '',
    is_critical: false,
    room_id: '',
    primary_protocol: '' as AutomationProtocol | '',
    primary_hub_id: '',
    primary_network_id: '',
    ecosystems: [] as AutomationEcosystem[],
    internet_required: false,
    local_control_available: true,
    power_type: '' as AutomationPowerType | '',
    battery_type: '',
    setup_instructions: '',
    reset_instructions: '',
    handover_notes: '',
    credential_reference: ''
  });

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const nextContext = await getAutomationContext();
        if (nextContext.mode !== 'supabase' || !nextContext.property) {
          if (isMounted) {
            setContext(nextContext);
            setNotReady('Sign in and select a property to record smart home devices.');
          }
          return;
        }
        const [roomList, h, n] = await Promise.all([
          getRoomsForProperty(nextContext.property.id),
          getHubsForContext(nextContext),
          getNetworksForContext(nextContext)
        ]);
        if (!isMounted) return;
        setContext(nextContext);
        setRooms(roomList as Room[]);
        setHubs(h);
        setNetworks(n);
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load.');
      }
    }
    load().catch((err) => {
      if (isMounted) setError(err instanceof Error ? err.message : 'Failed to load data.');
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const locationPresets = useMemo(() => getAvailableLocationPresets(rooms), [rooms]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleEcosystem = (eco: AutomationEcosystem) =>
    setForm((prev) => ({
      ...prev,
      ecosystems: prev.ecosystems.includes(eco) ? prev.ecosystems.filter((e) => e !== eco) : [...prev.ecosystems, eco]
    }));

  const save = async () => {
    if (!context) return;
    if (!form.name.trim()) {
      setError('Device name is required.');
      setStep(0);
      return;
    }
    if (isLocationPresetValue(form.room_id) && (context.mode !== 'supabase' || !context.property)) {
      setError('Create a property before adding a new location.');
      setStep(1);
      return;
    }
    setSaving(true);
    setError('');

    const resolutionContext =
      context.mode === 'supabase' && context.property
        ? ({ mode: 'supabase', propertyId: context.property.id } as const)
        : ({ mode: 'demo' } as const);

    let createdRoomId: string | null = null;

    try {
      const resolved = await resolveLocationRoomId(form.room_id, resolutionContext);
      createdRoomId = resolved.createdRoomId;

      const created = await createDeviceForContext(context, {
        name: form.name.trim(),
        nickname: form.nickname.trim() || null,
        category: form.category,
        status: 'unknown',
        manufacturer: form.manufacturer.trim() || null,
        model: form.model.trim() || null,
        serial_number: form.serial_number.trim() || null,
        is_critical: form.is_critical,
        room_id: resolved.roomId,
        primary_protocol: form.primary_protocol || null,
        primary_hub_id: form.primary_hub_id || null,
        primary_network_id: form.primary_network_id || null,
        internet_required: form.internet_required,
        local_control_available: form.local_control_available,
        power_type: form.power_type || null,
        battery_type: form.battery_type.trim() || null,
        setup_instructions: form.setup_instructions.trim() || null,
        reset_instructions: form.reset_instructions.trim() || null,
        handover_notes: form.handover_notes.trim() || null,
        notes: null,
        credential_reference: form.credential_reference.trim() || null,
        ecosystems: form.ecosystems
      });
      router.push(`/automation/devices/${created.id}`);
    } catch (saveError) {
      // Picking a new location creates the space before the device is written.
      // If that write fails, take the space back out rather than leaving an
      // empty "Back yard" on the home map that nobody asked for.
      await rollbackCreatedLocation(createdRoomId, resolutionContext);
      setError(saveError instanceof Error ? saveError.message : 'Failed to save device.');
      setSaving(false);
    }
  };

  if (notReady) {
    return (
      <>
        <PageHeader title="Add a device" />
        <Card>
          <p style={{ color: 'var(--text-muted)' }}>{notReady}</p>
          <ActionLink href="/sign-in" variant="secondary">Sign in</ActionLink>
        </Card>
      </>
    );
  }

  const labelStyle = { display: 'block' as const };
  const fieldWrap = { display: 'grid' as const, gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' };

  return (
    <>
      <PageHeader eyebrow={`Step ${step + 1} of ${STEPS.length}`} title="Add a device" description={STEPS[step]}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => (
            <span
              key={s}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 3,
                background: i === step ? 'var(--color-brass-pale)' : 'transparent',
                color: i <= step ? 'var(--color-ink)' : 'var(--text-muted)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          {step === 0 ? (
            <div style={fieldWrap}>
              <label style={labelStyle}><span>Device name *</span><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Front door lock" style={{ marginTop: 6 }} /></label>
              <label style={labelStyle}><span>Nickname</span><Input value={form.nickname} onChange={(e) => set('nickname', e.target.value)} style={{ marginTop: 6 }} /></label>
              <label style={labelStyle}><span>Type</span>
                <Select value={form.category} onChange={(e) => set('category', e.target.value as AutomationDeviceCategory)} style={{ marginTop: 6 }}>
                  {AUTOMATION_DEVICE_CATEGORIES.map((c) => <option key={c} value={c}>{formatEnumLabel(c)}</option>)}
                </Select>
              </label>
              <label style={labelStyle}><span>Manufacturer</span><Input value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} placeholder="Yale" style={{ marginTop: 6 }} /></label>
              <label style={labelStyle}><span>Model</span><Input value={form.model} onChange={(e) => set('model', e.target.value)} style={{ marginTop: 6 }} /></label>
              <label style={labelStyle}><span>Serial number</span><Input value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} style={{ marginTop: 6 }} /></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 24 }}>
                <input type="checkbox" checked={form.is_critical} onChange={(e) => set('is_critical', e.target.checked)} />
                <span>Critical device (safety/security/entry)</span>
              </label>
            </div>
          ) : null}

          {step === 1 ? (
            <div style={fieldWrap}>
              <div>
                <label style={labelStyle}><span>Room</span>
                  <Select value={form.room_id} onChange={(e) => set('room_id', e.target.value)} style={{ marginTop: 6 }}>
                    <option value="">No room yet</option>
                    {rooms.length > 0 ? (
                      <optgroup label="Rooms & spaces">
                        {rooms.map((r) => <option key={r.id} value={r.id}>{formatRoomLocation(r)}</option>)}
                      </optgroup>
                    ) : null}
                    {locationPresets.length > 0 ? (
                      <optgroup label="Outdoor & exterior">
                        {locationPresets.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
                      </optgroup>
                    ) : null}
                  </Select>
                </label>
                <p style={{ marginTop: 6, marginBottom: 0, color: 'var(--text-muted)', fontSize: 14 }}>
                  Pick a room, or an outdoor spot like the back yard or a side of the house — new spots are added to your home when you save.
                </p>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={fieldWrap}>
                <label style={labelStyle}><span>Connects via</span>
                  <Select value={form.primary_protocol} onChange={(e) => set('primary_protocol', e.target.value as AutomationProtocol | '')} style={{ marginTop: 6 }}>
                    <option value="">Unknown</option>
                    {AUTOMATION_PROTOCOLS.map((p) => <option key={p} value={p}>{formatEnumLabel(p)}</option>)}
                  </Select>
                </label>
                <label style={labelStyle}><span>Through hub</span>
                  <Select value={form.primary_hub_id} onChange={(e) => set('primary_hub_id', e.target.value)} style={{ marginTop: 6 }}>
                    <option value="">Directly (no hub)</option>
                    {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </Select>
                </label>
                <label style={labelStyle}><span>On network</span>
                  <Select value={form.primary_network_id} onChange={(e) => set('primary_network_id', e.target.value)} style={{ marginTop: 6 }}>
                    <option value="">Not sure</option>
                    {networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </Select>
                </label>
              </div>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Ecosystems (can be more than one)</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {AUTOMATION_ECOSYSTEMS.map((eco) => (
                    <button
                      key={eco}
                      type="button"
                      onClick={() => toggleEcosystem(eco)}
                      className="shortcut-link"
                      style={{
                        border: '1px solid var(--border-subtle)',
                        background: form.ecosystems.includes(eco) ? 'var(--color-brass-pale)' : 'transparent',
                        color: 'var(--color-ink)'
                      }}
                    >
                      {formatEnumLabel(eco)}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.internet_required} onChange={(e) => set('internet_required', e.target.checked)} />
                  <span>Needs internet to work</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.local_control_available} onChange={(e) => set('local_control_available', e.target.checked)} />
                  <span>Works locally (on the home network)</span>
                </label>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div style={fieldWrap}>
              <label style={labelStyle}><span>Power</span>
                <Select value={form.power_type} onChange={(e) => set('power_type', e.target.value as AutomationPowerType | '')} style={{ marginTop: 6 }}>
                  <option value="">Not sure</option>
                  {AUTOMATION_POWER_TYPES.map((p) => <option key={p} value={p}>{formatEnumLabel(p)}</option>)}
                </Select>
              </label>
              <label style={labelStyle}><span>Battery type (if any)</span><Input value={form.battery_type} onChange={(e) => set('battery_type', e.target.value)} placeholder="CR123A x2" style={{ marginTop: 6 }} /></label>
            </div>
          ) : null}

          {step === 4 ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <label style={labelStyle}><span>Setup instructions</span><textarea value={form.setup_instructions} onChange={(e) => set('setup_instructions', e.target.value)} style={{ width: '100%', minHeight: 60, marginTop: 6, padding: 10 }} /></label>
              <label style={labelStyle}><span>Reset instructions</span><textarea value={form.reset_instructions} onChange={(e) => set('reset_instructions', e.target.value)} style={{ width: '100%', minHeight: 60, marginTop: 6, padding: 10 }} /></label>
              <label style={labelStyle}><span>Handover notes</span><textarea value={form.handover_notes} onChange={(e) => set('handover_notes', e.target.value)} style={{ width: '100%', minHeight: 60, marginTop: 6, padding: 10 }} /></label>
              <label style={labelStyle}>
                <span>Where credentials are stored (reference only — never the password)</span>
                <Input value={form.credential_reference} onChange={(e) => set('credential_reference', e.target.value)} placeholder="1Password › Front door lock" style={{ marginTop: 6 }} />
              </label>
            </div>
          ) : null}

          {step === 5 ? (
            <div>
              <h2 style={{ marginTop: 0 }}>Review</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
                <strong>{form.nickname || form.name || 'Untitled device'}</strong> — {formatEnumLabel(form.category)}
                {form.primary_protocol ? ` · ${formatEnumLabel(form.primary_protocol)}` : ''}
                {form.is_critical ? ' · Critical' : ''}
              </p>
              <p style={{ color: 'var(--text-muted)' }}>
                You can save now and fill in the rest later from the device's record. Nothing here stores a real password.
              </p>
              {error ? <p style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p> : null}
            </div>
          ) : null}
        </Card>

        <Card>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              {step > 0 ? <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>Back</Button> : <ActionLink href="/automation/devices" variant="secondary">Cancel</ActionLink>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {step < STEPS.length - 1 ? (
                <>
                  <Button variant="secondary" onClick={save} disabled={saving || !form.name.trim()}>Save &amp; finish later</Button>
                  <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
                </>
              ) : (
                <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Saving…' : 'Save device'}</Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
