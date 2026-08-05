import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { AUTOMATION_NETWORK_TYPES, formatEnumLabel, sortEnumForDisplay, type AutomationNetworkType } from '@home-folder/shared';
import { Button, Card, Input, PageHeader, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../../components/ActionLink';
import { ViewOnlyNotice } from '../../../components/ViewOnlyNotice';
import { usePropertyAccess } from '../../../lib/access';
import {
  deleteNetworkForContext,
  getAutomationContext,
  getNetworkById,
  updateNetworkForContext,
  type AutomationDataContext,
  type AutomationNetworkRow
} from '../../../lib/automation';
import { getRoomsForProperty } from '../../../lib/rooms';
import { formatRoomLocation } from '../../../lib/roomLabels';

type Room = { id: string; name: string; room_type?: string | null; floor_name?: string | null };

// Sentinel for "somewhere that isn't a mapped room" in the router-location
// dropdown; the stored value is always the label text.
const CUSTOM_LOCATION_VALUE = '__custom-location__';

export default function NetworkDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const networkId = typeof id === 'string' ? id : '';

  const access = usePropertyAccess();
  const [context, setContext] = useState<AutomationDataContext | null>(null);
  const [network, setNetwork] = useState<AutomationNetworkRow | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [locationChoice, setLocationChoice] = useState('');
  const [locationCustom, setLocationCustom] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!networkId) return;
      setLoading(true);
      setError('');
      try {
        const ctx = await getAutomationContext();
        const row = await getNetworkById(ctx, networkId);
        const roomList =
          ctx.mode === 'supabase' && ctx.property
            ? ((await getRoomsForProperty(ctx.property.id)) as Room[])
            : [];
        if (!isMounted) return;
        setContext(ctx);
        setNetwork(row);
        setRooms(roomList);
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e.message : 'Failed to load network.');
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
  }, [networkId]);

  const startEdit = () => {
    if (!network) return;
    // The stored location is plain text. When it matches a mapped room's label
    // the dropdown opens on that room; anything else opens as custom text.
    const storedLocation = network.physical_location || '';
    const matchesRoom = rooms.some((room) => formatRoomLocation(room) === storedLocation);
    setLocationChoice(storedLocation ? (matchesRoom ? storedLocation : CUSTOM_LOCATION_VALUE) : '');
    setLocationCustom(storedLocation && !matchesRoom ? storedLocation : '');
    setForm({
      name: network.name,
      network_type: network.network_type,
      ssid: network.ssid || '',
      internet_provider: network.internet_provider || '',
      is_guest: network.is_guest,
      is_iot: network.is_iot,
      physical_location: network.physical_location || '',
      router_model: network.router_model || '',
      gateway: network.gateway || '',
      mesh_system: network.mesh_system || '',
      access_points: network.access_points || '',
      vlan: network.vlan || '',
      subnet: network.subnet || '',
      dhcp_range: network.dhcp_range || '',
      dns_notes: network.dns_notes || '',
      modem: network.modem || '',
      backup_internet: network.backup_internet || '',
      ups_backup: network.ups_backup || '',
      security_notes: network.security_notes || '',
      setup_instructions: network.setup_instructions || '',
      recovery_instructions: network.recovery_instructions || '',
      credential_reference: network.credential_reference || '',
      notes: network.notes || ''
    });
    setEditing(true);
  };

  // Every option should be visible on arrival — nobody should have to find
  // an Edit button to see what can be recorded (launch QA 2026-08-03).
  // Cancel still collapses to the read-only view for this visit.
  const autoOpenedEdit = useRef(false);
  useEffect(() => {
    if (!autoOpenedEdit.current && network && context?.mode === 'supabase') {
      autoOpenedEdit.current = true;
      startEdit();
    }
  });

  const save = async () => {
    if (!context || !network) return;
    setActing(true);
    setError('');
    try {
      const s = (k: string) => (typeof form[k] === 'string' ? (form[k] as string).trim() || null : null);
      const physicalLocation =
        locationChoice === CUSTOM_LOCATION_VALUE ? locationCustom.trim() || null : locationChoice || null;

      const updated = await updateNetworkForContext(context, network.id, {
        name: String(form.name || '').trim() || network.name,
        network_type: form.network_type as AutomationNetworkType,
        ssid: s('ssid'),
        internet_provider: s('internet_provider'),
        is_guest: Boolean(form.is_guest),
        is_iot: Boolean(form.is_iot),
        physical_location: physicalLocation,
        router_model: s('router_model'),
        gateway: s('gateway'),
        mesh_system: s('mesh_system'),
        access_points: s('access_points'),
        vlan: s('vlan'),
        subnet: s('subnet'),
        dhcp_range: s('dhcp_range'),
        dns_notes: s('dns_notes'),
        modem: s('modem'),
        backup_internet: s('backup_internet'),
        ups_backup: s('ups_backup'),
        security_notes: s('security_notes'),
        setup_instructions: s('setup_instructions'),
        recovery_instructions: s('recovery_instructions'),
        credential_reference: s('credential_reference'),
        notes: s('notes')
      });
      if (updated) setNetwork(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setActing(false);
    }
  };

  const remove = async () => {
    if (!context || !network) return;
    if (!window.confirm(`Remove "${network.name}"?`)) return;
    setActing(true);
    try {
      await deleteNetworkForContext(context, network.id);
      router.push('/automation/networks');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete.');
      setActing(false);
    }
  };

  if (loading) return (<><PageHeader title="Network" /><Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p></Card></>);
  if (error && !network) return (<><PageHeader title="Could not load this network" /><Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p><ActionLink href="/automation/networks" variant="secondary">Back to networks</ActionLink></Card></>);
  if (!network) return (<><PageHeader title="Network not found" /><Card><ActionLink href="/automation/networks" variant="secondary">Back to networks</ActionLink></Card></>);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <PageHeader eyebrow="Network" title={network.name} description={formatEnumLabel(network.network_type)}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {network.is_iot ? <UtilityBadge label="IoT" /> : null}
          {network.is_guest ? <UtilityBadge label="Guest" /> : null}
          {context?.mode === 'supabase' && !editing && (access.loading || access.canWrite) ? <Button variant="secondary" onClick={startEdit}>Edit</Button> : null}
          <ActionLink href="/automation/networks" variant="secondary">Back to networks</ActionLink>
          <ActionLink href="/automation" variant="secondary">Smart home overview</ActionLink>
        </div>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        {editing ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Edit network</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <label><span>Name</span><Input value={String(form.name ?? '')} onChange={(e) => set('name', e.target.value)} style={{ marginTop: 6 }} /></label>
                <label><span>Type</span><Select value={String(form.network_type ?? '')} onChange={(e) => set('network_type', e.target.value)} style={{ marginTop: 6 }}>{sortEnumForDisplay(AUTOMATION_NETWORK_TYPES).map((t) => <option key={t} value={t}>{formatEnumLabel(t)}</option>)}</Select></label>
                <label><span>Wi-Fi network name (SSID)</span><Input value={String(form.ssid ?? '')} onChange={(e) => set('ssid', e.target.value)} style={{ marginTop: 6 }} /></label>
                <label><span>Internet provider</span><Input value={String(form.internet_provider ?? '')} onChange={(e) => set('internet_provider', e.target.value)} style={{ marginTop: 6 }} /></label>
                <div style={{ display: 'grid', gap: 6 }}>
                  <label htmlFor="network-location-edit" style={{ fontWeight: 600 }}><span>Where the router sits</span></label>
                  <Select id="network-location-edit" value={locationChoice} onChange={(e) => setLocationChoice(e.target.value)}>
                    <option value="">Not recorded</option>
                    {rooms.length > 0 ? (
                      <optgroup label="Rooms on file">
                        {rooms.map((room) => (
                          <option key={room.id} value={formatRoomLocation(room)}>{formatRoomLocation(room)}</option>
                        ))}
                      </optgroup>
                    ) : null}
                    <option value={CUSTOM_LOCATION_VALUE}>Somewhere else…</option>
                  </Select>
                  {locationChoice === CUSTOM_LOCATION_VALUE ? (
                    <Input
                      value={locationCustom}
                      onChange={(e) => setLocationCustom(e.target.value)}
                      placeholder="Basement shelf by the panel"
                      aria-label="Where the router sits"
                    />
                  ) : null}
                </div>
              </div>
              {/* Migration 012 defined these columns and no form ever wrote them.
                  They are what someone needs to rebuild the network after a
                  router dies (launch review 2026-07-31). */}
              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Equipment and addressing</summary>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginTop: 12 }}>
                  <label><span>Router model</span><Input value={String(form.router_model ?? '')} onChange={(e) => set('router_model', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>Modem</span><Input value={String(form.modem ?? '')} onChange={(e) => set('modem', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>Mesh system</span><Input value={String(form.mesh_system ?? '')} onChange={(e) => set('mesh_system', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>Access points</span><Input value={String(form.access_points ?? '')} onChange={(e) => set('access_points', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>Gateway address</span><Input value={String(form.gateway ?? '')} onChange={(e) => set('gateway', e.target.value)} placeholder="192.168.1.1" style={{ marginTop: 6 }} /></label>
                  <label><span>Subnet</span><Input value={String(form.subnet ?? '')} onChange={(e) => set('subnet', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>VLAN</span><Input value={String(form.vlan ?? '')} onChange={(e) => set('vlan', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>DHCP range</span><Input value={String(form.dhcp_range ?? '')} onChange={(e) => set('dhcp_range', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>Backup internet</span><Input value={String(form.backup_internet ?? '')} onChange={(e) => set('backup_internet', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>Battery backup (UPS)</span><Input value={String(form.ups_backup ?? '')} onChange={(e) => set('ups_backup', e.target.value)} style={{ marginTop: 6 }} /></label>
                </div>
                <label style={{ display: 'block', marginTop: 12 }}><span>DNS notes</span><textarea value={String(form.dns_notes ?? '')} onChange={(e) => set('dns_notes', e.target.value)} style={{ width: '100%', minHeight: 54, marginTop: 6, padding: 10 }} /></label>
                <label style={{ display: 'block', marginTop: 12 }}><span>Security notes (reference only — never a password)</span><textarea value={String(form.security_notes ?? '')} onChange={(e) => set('security_notes', e.target.value)} style={{ width: '100%', minHeight: 54, marginTop: 6, padding: 10 }} /></label>
                <label style={{ display: 'block', marginTop: 12 }}><span>Setup instructions</span><textarea value={String(form.setup_instructions ?? '')} onChange={(e) => set('setup_instructions', e.target.value)} style={{ width: '100%', minHeight: 54, marginTop: 6, padding: 10 }} /></label>
              </details>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={Boolean(form.is_iot)} onChange={(e) => set('is_iot', e.target.checked)} /><span>IoT network</span></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={Boolean(form.is_guest)} onChange={(e) => set('is_guest', e.target.checked)} /><span>Guest network</span></label>
              </div>
              <label><span>Recovery instructions (shown in the emergency guide)</span><textarea value={String(form.recovery_instructions ?? '')} onChange={(e) => set('recovery_instructions', e.target.value)} style={{ width: '100%', minHeight: 54, marginTop: 6, padding: 10 }} placeholder="Power-cycle the modem, then the router; wait 3 min." /></label>
              <label><span>Where credentials are stored (reference only — never the Wi-Fi password)</span><Input value={String(form.credential_reference ?? '')} onChange={(e) => set('credential_reference', e.target.value)} placeholder="1Password › Home Wi-Fi" style={{ marginTop: 6 }} /></label>
              <label><span>Notes</span><textarea value={String(form.notes ?? '')} onChange={(e) => set('notes', e.target.value)} style={{ width: '100%', minHeight: 54, marginTop: 6, padding: 10 }} /></label>
              <div style={{ display: 'flex', gap: 8 }}><Button onClick={save} disabled={acting}>{acting ? 'Saving…' : 'Save'}</Button><Button variant="secondary" onClick={() => setEditing(false)} disabled={acting}>Cancel</Button></div>
            </div>
          </Card>
        ) : (
          <Card>
            <h2 style={{ marginTop: 0 }}>Details</h2>
            <div style={{ display: 'grid', gap: 6 }}>
              {network.ssid ? <div><strong>SSID:</strong> {network.ssid}</div> : null}
              {network.internet_provider ? <div><strong>Provider:</strong> {network.internet_provider}</div> : null}
              {network.physical_location ? <div><strong>Location:</strong> {network.physical_location}</div> : null}
              {network.router_model ? <div><strong>Router:</strong> {network.router_model}</div> : null}
              {network.modem ? <div><strong>Modem:</strong> {network.modem}</div> : null}
              {network.mesh_system ? <div><strong>Mesh system:</strong> {network.mesh_system}</div> : null}
              {network.access_points ? <div><strong>Access points:</strong> {network.access_points}</div> : null}
              {network.gateway ? <div><strong>Gateway:</strong> {network.gateway}</div> : null}
              {network.subnet ? <div><strong>Subnet:</strong> {network.subnet}</div> : null}
              {network.vlan ? <div><strong>VLAN:</strong> {network.vlan}</div> : null}
              {network.dhcp_range ? <div><strong>DHCP range:</strong> {network.dhcp_range}</div> : null}
              {network.dns_notes ? <div><strong>DNS:</strong> {network.dns_notes}</div> : null}
              {network.backup_internet ? <div><strong>Backup internet:</strong> {network.backup_internet}</div> : null}
              {network.ups_backup ? <div><strong>Battery backup:</strong> {network.ups_backup}</div> : null}
              {network.security_notes ? <div><strong>Security notes:</strong> {network.security_notes}</div> : null}
              {network.setup_instructions ? <div><strong>Setup:</strong> {network.setup_instructions}</div> : null}
              <div><strong>Recovery:</strong> {network.recovery_instructions || 'Not recorded'}</div>
              {network.credential_reference ? <div><strong>Credentials:</strong> {network.credential_reference} <span style={{ color: 'var(--text-muted)' }}>(reference only)</span></div> : null}
              {network.notes ? <div><strong>Notes:</strong> {network.notes}</div> : null}
            </div>
          </Card>
        )}
        {error ? <Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>{error}</p></Card> : null}
        <Card>
          <h2 style={{ marginTop: 0 }}>Manage</h2>
          {!access.loading && !access.canWrite ? (
            <ViewOnlyNotice role={access.role} action="remove this network" inline />
          ) : (
          <Button variant="secondary" onClick={remove} disabled={acting} style={{ color: 'var(--status-urgent)', borderColor: 'var(--status-urgent)' }}>Remove network</Button>
          )}
        </Card>
      </div>
    </>
  );
}
