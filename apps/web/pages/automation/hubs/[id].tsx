import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { AUTOMATION_CRITICALITIES, AUTOMATION_HUB_TYPES, formatEnumLabel, sortEnumForDisplay, type AutomationCriticality, type AutomationHubType } from '@home-folder/shared';
import { Button, Card, ConfirmDialog, Input, PageHeader, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../../components/ActionLink';
import { ViewOnlyNotice } from '../../../components/ViewOnlyNotice';
import { usePropertyAccess } from '../../../lib/access';
import { RoomLocationSelect, roomSelectionValue } from '../../../components/RoomLocationSelect';
import {
  deleteHubForContext,
  getAutomationContext,
  getHubById,
  getNetworksForContext,
  updateHubForContext,
  type AutomationDataContext,
  type AutomationHubRow,
  type AutomationNetworkRow
} from '../../../lib/automation';
import {
  isLocationPresetValue,
  resolveLocationRoomId,
  rollbackCreatedLocation
} from '../../../lib/locationPresets';
import { formatRoomLocation } from '../../../lib/roomLabels';
import { getRoomsForProperty } from '../../../lib/rooms';

type Room = { id: string; name: string; room_type?: string | null; floor_name?: string | null };

export default function HubDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const hubId = typeof id === 'string' ? id : '';

  const access = usePropertyAccess();
  const [context, setContext] = useState<AutomationDataContext | null>(null);
  const [hub, setHub] = useState<AutomationHubRow | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [networks, setNetworks] = useState<AutomationNetworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  // Two-step removal: the Remove button only opens this dialog; nothing is
  // deleted until the dialog is confirmed. window.confirm proved unreliable
  // (a suppressed dialog returns false and the click dies silently).
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!hubId) return;
      setLoading(true);
      setError('');
      try {
        const ctx = await getAutomationContext();
        const row = await getHubById(ctx, hubId);
        let roomList: Room[] = [];
        let networkList: AutomationNetworkRow[] = [];
        if (ctx.mode === 'supabase' && ctx.property) {
          const [nextRooms, nextNetworks] = await Promise.all([
            getRoomsForProperty(ctx.property.id),
            getNetworksForContext(ctx)
          ]);
          roomList = nextRooms as Room[];
          networkList = nextNetworks;
        }
        if (!isMounted) return;
        setContext(ctx);
        setHub(row);
        setRooms(roomList);
        setNetworks(networkList);
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e.message : 'Failed to load hub.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load().catch((e) => {
      if (isMounted) {
        setError(e instanceof Error ? e.message : 'Failed to load data.');
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [hubId]);

  const startEdit = () => {
    if (!hub) return;
    setForm({
      name: hub.name,
      hub_type: hub.hub_type,
      room_id: hub.room_id || '',
      room_custom_name: '',
      network_id: hub.network_id || '',
      manufacturer: hub.manufacturer || '',
      model: hub.model || '',
      criticality: hub.criticality,
      local_control: hub.local_control,
      cloud_dependency: hub.cloud_dependency,
      internet_dependency: hub.internet_dependency,
      firmware_version: hub.firmware_version || '',
      recovery_steps: hub.recovery_steps || '',
      reset_instructions: hub.reset_instructions || '',
      credential_reference: hub.credential_reference || '',
      notes: hub.notes || ''
    });
    setEditing(true);
  };

  // Every option should be visible on arrival — nobody should have to find
  // an Edit button to see what can be recorded (launch QA 2026-08-03).
  // Cancel still collapses to the read-only view for this visit.
  const autoOpenedEdit = useRef(false);
  useEffect(() => {
    if (!autoOpenedEdit.current && hub && context?.mode === 'supabase') {
      autoOpenedEdit.current = true;
      startEdit();
    }
  });

  const save = async () => {
    if (!context || !hub) return;

    const roomValue = roomSelectionValue(String(form.room_id ?? ''), String(form.room_custom_name ?? ''));
    if (roomValue === null) {
      setError('Give the new room a name, or pick one from the list.');
      return;
    }
    if (isLocationPresetValue(roomValue) && (context.mode !== 'supabase' || !context.property)) {
      setError('Create a property before adding a new location.');
      return;
    }

    setActing(true);
    setError('');

    const resolutionContext =
      context.mode === 'supabase' && context.property
        ? ({ mode: 'supabase', propertyId: context.property.id } as const)
        : ({ mode: 'demo' } as const);

    let createdRoomId: string | null = null;

    try {
      const wasPreset = isLocationPresetValue(roomValue);
      const resolved = await resolveLocationRoomId(roomValue, resolutionContext);
      createdRoomId = resolved.createdRoomId;

      const s = (k: string) => (typeof form[k] === 'string' ? (form[k] as string).trim() || null : null);
      const updated = await updateHubForContext(context, hub.id, {
        name: String(form.name || '').trim() || hub.name,
        hub_type: form.hub_type as AutomationHubType,
        room_id: resolved.roomId,
        network_id: s('network_id'),
        manufacturer: s('manufacturer'),
        model: s('model'),
        criticality: form.criticality as AutomationCriticality,
        local_control: Boolean(form.local_control),
        cloud_dependency: Boolean(form.cloud_dependency),
        internet_dependency: Boolean(form.internet_dependency),
        firmware_version: s('firmware_version'),
        recovery_steps: s('recovery_steps'),
        reset_instructions: s('reset_instructions'),
        credential_reference: s('credential_reference'),
        notes: s('notes')
      });
      if (updated) {
        setHub(updated);
        setForm((f) => ({ ...f, room_id: updated.room_id || '', room_custom_name: '' }));
      }
      if (wasPreset && context.mode === 'supabase' && context.property) {
        setRooms((await getRoomsForProperty(context.property.id)) as Room[]);
      }
      setEditing(false);
    } catch (e) {
      // The room is created before the hub is updated. If the update fails,
      // remove it again rather than leaving an empty space on the home map.
      await rollbackCreatedLocation(createdRoomId, resolutionContext);
      setError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setActing(false);
    }
  };

  const requestRemove = () => {
    if (!context || !hub) return;
    setError('');
    setConfirmingDelete(true);
  };

  const handleRemove = async () => {
    if (!context || !hub || acting) return;
    setActing(true);
    try {
      await deleteHubForContext(context, hub.id);
      router.push('/automation/hubs');
    } catch (e) {
      // Close the dialog so the error is readable on the page it points at.
      setConfirmingDelete(false);
      setError(e instanceof Error ? e.message : 'Failed to delete.');
      setActing(false);
    }
  };

  if (loading) return (<><PageHeader title="Hub" /><Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p></Card></>);
  if (error && !hub) return (<><PageHeader title="Could not load this hub" /><Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p><ActionLink href="/automation/hubs" variant="secondary">Back to hubs</ActionLink></Card></>);
  if (!hub) return (<><PageHeader title="Hub not found" /><Card><ActionLink href="/automation/hubs" variant="secondary">Back to hubs</ActionLink></Card></>);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <PageHeader eyebrow="Hub / controller" title={hub.name} description={formatEnumLabel(hub.hub_type)}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <UtilityBadge label={formatEnumLabel(hub.status)} />
          {hub.internet_dependency ? <UtilityBadge label="Needs internet" tone="attention" /> : <UtilityBadge label="Local" tone="good" />}
          {hub.criticality === 'critical' || hub.criticality === 'high' ? <UtilityBadge label={formatEnumLabel(hub.criticality)} tone="attention" /> : null}
          {context?.mode === 'supabase' && !editing && (access.loading || access.canWrite) ? <Button variant="secondary" onClick={startEdit}>Edit</Button> : null}
          <ActionLink href="/automation/hubs" variant="secondary">Back to hubs</ActionLink>
          <ActionLink href="/automation" variant="secondary">Smart home overview</ActionLink>
        </div>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        {editing ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Edit hub</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <label><span>Name</span><Input value={String(form.name ?? '')} onChange={(e) => set('name', e.target.value)} style={{ marginTop: 6 }} /></label>
                <label><span>Type</span><Select value={String(form.hub_type ?? '')} onChange={(e) => set('hub_type', e.target.value)} style={{ marginTop: 6 }}>{sortEnumForDisplay(AUTOMATION_HUB_TYPES).map((t) => <option key={t} value={t}>{formatEnumLabel(t)}</option>)}</Select></label>
                <label><span>Importance</span><Select value={String(form.criticality ?? '')} onChange={(e) => set('criticality', e.target.value)} style={{ marginTop: 6 }}>{AUTOMATION_CRITICALITIES.map((c) => <option key={c} value={c}>{formatEnumLabel(c)}</option>)}</Select></label>
                <label><span>Manufacturer</span><Input value={String(form.manufacturer ?? '')} onChange={(e) => set('manufacturer', e.target.value)} style={{ marginTop: 6 }} /></label>
                <label><span>Model</span><Input value={String(form.model ?? '')} onChange={(e) => set('model', e.target.value)} style={{ marginTop: 6 }} /></label>
                <label><span>Firmware</span><Input value={String(form.firmware_version ?? '')} onChange={(e) => set('firmware_version', e.target.value)} style={{ marginTop: 6 }} /></label>
                <RoomLocationSelect
                  rooms={rooms}
                  value={String(form.room_id ?? '')}
                  onChange={(value) => set('room_id', value)}
                  customName={String(form.room_custom_name ?? '')}
                  onCustomNameChange={(value) => set('room_custom_name', value)}
                  label="Where it sits"
                  emptyLabel="No room recorded"
                />
                <label><span>On network</span>
                  <Select value={String(form.network_id ?? '')} onChange={(e) => set('network_id', e.target.value)} style={{ marginTop: 6 }}>
                    <option value="">Not recorded</option>
                    {networks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}
                  </Select>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={Boolean(form.local_control)} onChange={(e) => set('local_control', e.target.checked)} /><span>Works locally</span></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={Boolean(form.internet_dependency)} onChange={(e) => set('internet_dependency', e.target.checked)} /><span>Needs internet</span></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={Boolean(form.cloud_dependency)} onChange={(e) => set('cloud_dependency', e.target.checked)} /><span>Depends on a cloud service</span></label>
              </div>
              <label><span>Recovery steps (shown in the emergency guide)</span><textarea value={String(form.recovery_steps ?? '')} onChange={(e) => set('recovery_steps', e.target.value)} style={{ width: '100%', minHeight: 54, marginTop: 6, padding: 10 }} /></label>
              <label><span>Reset instructions</span><textarea value={String(form.reset_instructions ?? '')} onChange={(e) => set('reset_instructions', e.target.value)} style={{ width: '100%', minHeight: 54, marginTop: 6, padding: 10 }} /></label>
              <label><span>Where credentials are stored (reference only)</span><Input value={String(form.credential_reference ?? '')} onChange={(e) => set('credential_reference', e.target.value)} placeholder="1Password › Hub account" style={{ marginTop: 6 }} /></label>
              <label><span>Notes</span><textarea value={String(form.notes ?? '')} onChange={(e) => set('notes', e.target.value)} style={{ width: '100%', minHeight: 54, marginTop: 6, padding: 10 }} /></label>
              <div style={{ display: 'flex', gap: 8 }}><Button onClick={save} disabled={acting}>{acting ? 'Saving…' : 'Save'}</Button><Button variant="secondary" onClick={() => setEditing(false)} disabled={acting}>Cancel</Button></div>
            </div>
          </Card>
        ) : (
          <Card>
            <h2 style={{ marginTop: 0 }}>Recovery &amp; details</h2>
            <div style={{ display: 'grid', gap: 6 }}>
              <div>
                <strong>Where it sits:</strong>{' '}
                {hub.room_id
                  ? formatRoomLocation(rooms.find((room) => room.id === hub.room_id) || { name: 'Unknown room' })
                  : 'Not recorded'}
              </div>
              <div>
                <strong>On network:</strong>{' '}
                {hub.network_id ? networks.find((network) => network.id === hub.network_id)?.name || 'Unknown network' : 'Not recorded'}
              </div>
              <div><strong>Recovery:</strong> {hub.recovery_steps || 'Not recorded'}</div>
              <div><strong>Reset:</strong> {hub.reset_instructions || 'Not recorded'}</div>
              <div><strong>Firmware:</strong> {hub.firmware_version || 'Not recorded'}</div>
              {hub.credential_reference ? <div><strong>Credentials:</strong> {hub.credential_reference} <span style={{ color: 'var(--text-muted)' }}>(reference only)</span></div> : null}
              {hub.notes ? <div><strong>Notes:</strong> {hub.notes}</div> : null}
            </div>
          </Card>
        )}
        {error ? <Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>{error}</p></Card> : null}
        <Card>
          <h2 style={{ marginTop: 0 }}>Manage</h2>
          {!access.loading && !access.canWrite ? (
            <ViewOnlyNotice role={access.role} action="remove this hub" inline />
          ) : (
          <Button variant="secondary" onClick={requestRemove} disabled={acting} style={{ color: 'var(--status-urgent)', borderColor: 'var(--status-urgent)' }}>Remove hub</Button>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Remove ${hub.name}?`}
        description="Devices that depend on it will lose the link."
        confirmLabel="Remove hub"
        cancelLabel="Cancel"
        busy={acting}
        onConfirm={handleRemove}
        onCancel={() => {
          if (!acting) setConfirmingDelete(false);
        }}
      />
    </>
  );
}
