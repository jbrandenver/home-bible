import { useEffect, useState } from 'react';
import { AUTOMATION_NETWORK_TYPES, formatEnumLabel, sortEnumForDisplay, type AutomationNetworkType } from '@home-folder/shared';
import { Button, Card, EmptyState, Input, PageHeader, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import { ViewOnlyNotice } from '../../components/ViewOnlyNotice';
import { usePropertyAccess } from '../../lib/access';
import {
  createNetworkForContext,
  deleteNetworkForContext,
  getAutomationContext,
  getNetworksForContext,
  type AutomationDataContext,
  type AutomationDataMode,
  type AutomationNetworkRow
} from '../../lib/automation';
import { getRoomsForProperty } from '../../lib/rooms';
import { formatRoomLocation } from '../../lib/roomLabels';

type Room = { id: string; name: string; room_type?: string | null; floor_name?: string | null };

// Sentinel for "somewhere that isn't a mapped room" in the router-location
// dropdown. The chosen room's label (or the typed text) is what gets stored —
// networks record where equipment physically sits, not a room link.
const CUSTOM_LOCATION_VALUE = '__custom-location__';

const textareaStyle = { width: '100%', minHeight: 54, marginTop: 6, padding: 10 };

export default function AutomationNetworksPage() {
  const access = usePropertyAccess();
  const [context, setContext] = useState<AutomationDataContext | null>(null);
  const [dataMode, setDataMode] = useState<AutomationDataMode>('demo');
  const [networks, setNetworks] = useState<AutomationNetworkRow[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [networkType, setNetworkType] = useState<AutomationNetworkType>('wifi');
  const [ssid, setSsid] = useState('');
  const [provider, setProvider] = useState('');
  const [locationChoice, setLocationChoice] = useState('');
  const [locationCustom, setLocationCustom] = useState('');
  const [details, setDetails] = useState<Record<string, string>>({});
  const [isIot, setIsIot] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [savedNote, setSavedNote] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const nextContext = await getAutomationContext();
        const list = await getNetworksForContext(nextContext);
        // The router-location dropdown offers the mapped rooms, so "where the
        // router sits" is a pick rather than a guess at wording.
        const roomList =
          nextContext.mode === 'supabase' && nextContext.property
            ? ((await getRoomsForProperty(nextContext.property.id)) as Room[])
            : [];
        if (!isMounted) return;
        setContext(nextContext);
        setDataMode(nextContext.mode);
        setNetworks(list);
        setRooms(roomList);
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load networks.');
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

  const setDetail = (key: string, value: string) => setDetails((current) => ({ ...current, [key]: value }));
  const detail = (key: string) => details[key] ?? '';
  const detailOrNull = (key: string) => (details[key] ?? '').trim() || null;

  const add = async () => {
    if (!context) return;
    if (!name.trim()) {
      setFormError('Give the network a name first — "Home Wi-Fi" works.');
      return;
    }
    if (locationChoice === CUSTOM_LOCATION_VALUE && !locationCustom.trim()) {
      setFormError('Say where the router sits, or set the location back to "Not recorded".');
      return;
    }
    setSaving(true);
    setFormError('');
    setSavedNote('');
    try {
      const physicalLocation =
        locationChoice === CUSTOM_LOCATION_VALUE ? locationCustom.trim() : locationChoice || null;

      const created = await createNetworkForContext(context, {
        name: name.trim(),
        network_type: networkType,
        ssid: ssid.trim() || null,
        internet_provider: provider.trim() || null,
        is_guest: isGuest || networkType === 'guest',
        is_iot: isIot || networkType === 'iot_vlan',
        physical_location: physicalLocation,
        router_model: detailOrNull('router_model'),
        modem: detailOrNull('modem'),
        mesh_system: detailOrNull('mesh_system'),
        access_points: detailOrNull('access_points'),
        gateway: detailOrNull('gateway'),
        subnet: detailOrNull('subnet'),
        vlan: detailOrNull('vlan'),
        dhcp_range: detailOrNull('dhcp_range'),
        dns_notes: detailOrNull('dns_notes'),
        backup_internet: detailOrNull('backup_internet'),
        ups_backup: detailOrNull('ups_backup'),
        security_notes: detailOrNull('security_notes'),
        setup_instructions: detailOrNull('setup_instructions'),
        recovery_instructions: detailOrNull('recovery_instructions'),
        credential_reference: detailOrNull('credential_reference'),
        notes: detailOrNull('notes')
      });
      setNetworks((current) => [created, ...current].sort((a, b) => a.name.localeCompare(b.name)));
      setSavedNote(`Saved ${created.name}.`);
      setName('');
      setSsid('');
      setProvider('');
      setLocationChoice('');
      setLocationCustom('');
      setDetails({});
      setIsIot(false);
      setIsGuest(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to add network.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (network: AutomationNetworkRow) => {
    if (!context) return;
    if (!window.confirm(`Remove "${network.name}"?`)) return;
    try {
      await deleteNetworkForContext(context, network.id);
      setNetworks((current) => current.filter((n) => n.id !== network.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete network.');
    }
  };

  return (
    <>
      <PageHeader eyebrow="Smart Home" title="Networks" description="The Wi-Fi, wired, IoT, and guest networks your devices live on.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ActionLink href="/automation" variant="secondary">Smart home overview</ActionLink>
          <ActionLink href="/dashboard" variant="secondary">Back to dashboard</ActionLink>
        </div>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        {dataMode === 'supabase' ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Add a network</h2>
            {!access.loading && !access.canWrite ? (
              <ViewOnlyNotice role={access.role} action="add networks" inline />
            ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', alignItems: 'start' }}>
                <label><span>Name (what you call it)</span><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Home Wi-Fi" style={{ marginTop: 6 }} /></label>
                <label><span>Type</span>
                  <Select value={networkType} onChange={(e) => setNetworkType(e.target.value as AutomationNetworkType)} style={{ marginTop: 6 }}>
                    {sortEnumForDisplay(AUTOMATION_NETWORK_TYPES).map((t) => <option key={t} value={t}>{formatEnumLabel(t)}</option>)}
                  </Select>
                </label>
                <label><span>Wi-Fi network name (SSID)</span><Input value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="What devices see when they scan" style={{ marginTop: 6 }} /></label>
                <label><span>Internet provider</span><Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Comcast, CenturyLink…" style={{ marginTop: 6 }} /></label>
                <div style={{ display: 'grid', gap: 6 }}>
                  <label htmlFor="network-location" style={{ fontWeight: 600 }}><span>Where the router sits</span></label>
                  <Select id="network-location" value={locationChoice} onChange={(e) => setLocationChoice(e.target.value)} disabled={loading}>
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
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    The physical spot — so someone can find the router when the internet is down.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={isIot} onChange={(e) => setIsIot(e.target.checked)} /><span>IoT network</span></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={isGuest} onChange={(e) => setIsGuest(e.target.checked)} /><span>Guest network</span></label>
              </div>

              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Equipment, addressing &amp; recovery (optional)</summary>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginTop: 12 }}>
                  <label><span>Router model</span><Input value={detail('router_model')} onChange={(e) => setDetail('router_model', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>Modem</span><Input value={detail('modem')} onChange={(e) => setDetail('modem', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>Mesh system</span><Input value={detail('mesh_system')} onChange={(e) => setDetail('mesh_system', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>Access points</span><Input value={detail('access_points')} onChange={(e) => setDetail('access_points', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>Gateway address</span><Input value={detail('gateway')} onChange={(e) => setDetail('gateway', e.target.value)} placeholder="192.168.1.1" style={{ marginTop: 6 }} /></label>
                  <label><span>Subnet</span><Input value={detail('subnet')} onChange={(e) => setDetail('subnet', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>VLAN</span><Input value={detail('vlan')} onChange={(e) => setDetail('vlan', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>DHCP range</span><Input value={detail('dhcp_range')} onChange={(e) => setDetail('dhcp_range', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>Backup internet</span><Input value={detail('backup_internet')} onChange={(e) => setDetail('backup_internet', e.target.value)} style={{ marginTop: 6 }} /></label>
                  <label><span>Battery backup (UPS)</span><Input value={detail('ups_backup')} onChange={(e) => setDetail('ups_backup', e.target.value)} style={{ marginTop: 6 }} /></label>
                </div>
                <label style={{ display: 'block', marginTop: 12 }}><span>DNS notes</span><textarea value={detail('dns_notes')} onChange={(e) => setDetail('dns_notes', e.target.value)} style={textareaStyle} /></label>
                <label style={{ display: 'block', marginTop: 12 }}><span>Security notes (reference only — never a password)</span><textarea value={detail('security_notes')} onChange={(e) => setDetail('security_notes', e.target.value)} style={textareaStyle} /></label>
                <label style={{ display: 'block', marginTop: 12 }}><span>Setup instructions</span><textarea value={detail('setup_instructions')} onChange={(e) => setDetail('setup_instructions', e.target.value)} style={textareaStyle} /></label>
                <label style={{ display: 'block', marginTop: 12 }}><span>Recovery instructions (shown in the emergency guide)</span><textarea value={detail('recovery_instructions')} onChange={(e) => setDetail('recovery_instructions', e.target.value)} placeholder="Power-cycle the modem, then the router; wait 3 min." style={textareaStyle} /></label>
                <label style={{ display: 'block', marginTop: 12 }}><span>Where credentials are stored (reference only — never the Wi-Fi password)</span><Input value={detail('credential_reference')} onChange={(e) => setDetail('credential_reference', e.target.value)} placeholder="1Password › Home Wi-Fi" style={{ marginTop: 6 }} /></label>
                <label style={{ display: 'block', marginTop: 12 }}><span>Notes</span><textarea value={detail('notes')} onChange={(e) => setDetail('notes', e.target.value)} style={textareaStyle} /></label>
              </details>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button onClick={add} disabled={saving}>{saving ? 'Adding…' : 'Add network'}</Button>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Never enter a Wi-Fi password here. Store it in a password manager and reference it above.</p>
              </div>
              {formError ? <p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }} role="alert">{formError}</p> : null}
              {savedNote ? <p style={{ color: 'var(--status-good)', fontWeight: 600, margin: 0 }} role="status">{savedNote}</p> : null}
            </div>
            )}
          </Card>
        ) : null}

        {error ? <Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>{error}</p></Card> : null}

        {loading ? (
          <Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading networks…</p></Card>
        ) : dataMode === 'demo' ? (
          <EmptyState title="Sign in to record networks" description="Networks save to your account." />
        ) : networks.length === 0 ? (
          <EmptyState title="No networks recorded" description="Add your main Wi-Fi, any IoT/guest network, and the wired network if you have one." />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {networks.map((network) => (
              <Card key={network.id} style={{ padding: '14px 14px 14px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <div>
                    <strong style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{network.name}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{[formatEnumLabel(network.network_type), network.ssid ? `SSID: ${network.ssid}` : null, network.internet_provider].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {network.is_iot ? <UtilityBadge label="IoT" /> : null}
                    {network.is_guest ? <UtilityBadge label="Guest" /> : null}
                    <ActionLink href={`/automation/networks/${network.id}`} variant="secondary">Open</ActionLink>
                    {access.loading || access.canWrite ? (
                    <Button variant="secondary" onClick={() => remove(network)} style={{ color: 'var(--status-urgent)', borderColor: 'var(--status-urgent)' }}>Remove</Button>
                    ) : null}
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
