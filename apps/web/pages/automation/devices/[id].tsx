import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AUTOMATION_DEVICE_STATUSES, AUTOMATION_STATUS_LABELS, formatEnumLabel, type AutomationDeviceStatus } from '@home-folder/shared';
import { Button, Card, Input, PageHeader, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../../components/ActionLink';
import {
  createIssueForDevice,
  createRelationshipForContext,
  createRepairForDevice,
  deleteDeviceForContext,
  deleteRelationshipForContext,
  getAutomationContext,
  getDeviceById,
  getDeviceLinkedRecords,
  getHubsForContext,
  getNetworksForContext,
  getRelationshipsForContext,
  getRoutineDeviceLinksForContext,
  getRoutinesForContext,
  updateDeviceForContext,
  updateDeviceStatusForContext,
  type AutomationDataContext,
  type AutomationDeviceRow,
  type AutomationHubRow,
  type AutomationNetworkRow,
  type DeviceLinkedRecords
} from '../../../lib/automation';
import { deviceSetupCompleteness } from '../../../lib/automationOverview';
import { getRoomsForProperty } from '../../../lib/rooms';
import { formatRoomLocation } from '../../../lib/roomLabels';

type Room = { id: string; name: string; room_type?: string | null; floor_name?: string | null };

function LinkedGroup({ title, items, empty }: { title: string; items: Array<{ id: string; title: string; subtitle: string | null; href: string }>; empty: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>{empty}</p>
      ) : (
        <div style={{ display: 'grid', gap: 4 }}>
          {items.map((item) => (
            <Link key={item.id} href={item.href} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 3 }}>
              <span>{item.title}</span>
              {item.subtitle ? <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{item.subtitle}</span> : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}

export default function AutomationDeviceDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const deviceId = typeof id === 'string' ? id : '';

  const [context, setContext] = useState<AutomationDataContext | null>(null);
  const [device, setDevice] = useState<AutomationDeviceRow | null>(null);
  const [rooms, setRooms] = useState<Map<string, string>>(new Map());
  const [hubs, setHubs] = useState<AutomationHubRow[]>([]);
  const [networks, setNetworks] = useState<AutomationNetworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [linked, setLinked] = useState<DeviceLinkedRecords | null>(null);
  const [relatedAutomations, setRelatedAutomations] = useState<Array<{ id: string; name: string }>>([]);
  const [dependencies, setDependencies] = useState<Array<{ id: string; label: string }>>([]);
  const [issueTitle, setIssueTitle] = useState('');
  const [repairTitle, setRepairTitle] = useState('');
  const [quickMsg, setQuickMsg] = useState('');
  const [cloudDep, setCloudDep] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string | boolean>>({});

  const reloadLinked = async (ctx: AutomationDataContext, id: string) => {
    setLinked(await getDeviceLinkedRecords(ctx, id));
  };

  const reloadDependencies = async (ctx: AutomationDataContext, id: string) => {
    const relationships = await getRelationshipsForContext(ctx);
    setDependencies(
      relationships
        .filter((rel) => rel.source_type === 'device' && rel.source_id === id)
        .map((rel) => ({ id: rel.id, label: `${rel.relationship_type.replace(/_/g, ' ')} ${rel.target_label || rel.target_type}` }))
    );
  };

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!deviceId) return;
      setLoading(true);
      setError('');
      try {
        const nextContext = await getAutomationContext();
        const nextDevice = await getDeviceById(nextContext, deviceId);
        let roomMap = new Map<string, string>();
        let hubList: AutomationHubRow[] = [];
        let networkList: AutomationNetworkRow[] = [];
        if (nextContext.mode === 'supabase' && nextContext.property) {
          const [roomList, h, n] = await Promise.all([
            getRoomsForProperty(nextContext.property.id),
            getHubsForContext(nextContext),
            getNetworksForContext(nextContext)
          ]);
          roomMap = new Map((roomList as Room[]).map((room) => [room.id, formatRoomLocation(room)]));
          hubList = h;
          networkList = n;
        }
        // Integration: records linked to this device + related automations + dependencies.
        let linkedRecords: DeviceLinkedRecords | null = null;
        let related: Array<{ id: string; name: string }> = [];
        let deps: Array<{ id: string; label: string }> = [];
        if (nextContext.mode === 'supabase' && nextDevice) {
          const [links, routineLinks, routines, relationships] = await Promise.all([
            getDeviceLinkedRecords(nextContext, deviceId),
            getRoutineDeviceLinksForContext(nextContext),
            getRoutinesForContext(nextContext),
            getRelationshipsForContext(nextContext)
          ]);
          linkedRecords = links;
          const routineName = new Map(routines.map((r) => [r.id, r.name]));
          related = Array.from(new Set(routineLinks.filter((l) => l.device_id === deviceId).map((l) => l.routine_id)))
            .map((rid) => ({ id: rid, name: routineName.get(rid) || 'Automation' }));
          deps = relationships
            .filter((rel) => rel.source_type === 'device' && rel.source_id === deviceId)
            .map((rel) => ({ id: rel.id, label: `${rel.relationship_type.replace(/_/g, ' ')} ${rel.target_label || rel.target_type}` }));
        }

        if (!isMounted) return;
        setContext(nextContext);
        setDevice(nextDevice);
        setRooms(roomMap);
        setHubs(hubList);
        setNetworks(networkList);
        setLinked(linkedRecords);
        setRelatedAutomations(related);
        setDependencies(deps);
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load device.');
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
  }, [deviceId]);

  const completeness = useMemo(() => (device ? deviceSetupCompleteness(device) : 0), [device]);
  const hubName = device?.primary_hub_id ? hubs.find((h) => h.id === device.primary_hub_id)?.name : null;
  const networkName = device?.primary_network_id ? networks.find((n) => n.id === device.primary_network_id)?.name : null;

  const changeStatus = async (status: AutomationDeviceStatus) => {
    if (!context || !device) return;
    setActing(true);
    setError('');
    try {
      await updateDeviceStatusForContext(context, device.id, status);
      setDevice({ ...device, status });
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update status.');
    } finally {
      setActing(false);
    }
  };

  const reportIssue = async () => {
    if (!context || !device) return;
    setActing(true);
    setQuickMsg('');
    setError('');
    try {
      await createIssueForDevice(context, device.id, issueTitle || `Issue with ${device.nickname || device.name}`);
      await reloadLinked(context, device.id);
      setIssueTitle('');
      setQuickMsg('Issue reported and linked to this device.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to report issue.');
    } finally {
      setActing(false);
    }
  };

  const logRepair = async () => {
    if (!context || !device) return;
    setActing(true);
    setQuickMsg('');
    setError('');
    try {
      await createRepairForDevice(context, device.id, repairTitle || `Repair: ${device.nickname || device.name}`);
      await reloadLinked(context, device.id);
      setRepairTitle('');
      setQuickMsg('Repair logged and linked to this device.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to log repair.');
    } finally {
      setActing(false);
    }
  };

  const startEdit = () => {
    if (!device) return;
    setEditForm({
      nickname: device.nickname || '',
      manufacturer: device.manufacturer || '',
      model: device.model || '',
      serial_number: device.serial_number || '',
      battery_type: device.battery_type || '',
      firmware_version: device.firmware_version || '',
      setup_instructions: device.setup_instructions || '',
      reset_instructions: device.reset_instructions || '',
      troubleshooting_notes: device.troubleshooting_notes || '',
      handover_notes: device.handover_notes || '',
      notes: device.notes || '',
      is_critical: device.is_critical
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!context || !device) return;
    setActing(true);
    setError('');
    try {
      const s = (k: string) => (typeof editForm[k] === 'string' ? (editForm[k] as string).trim() || null : null);
      const updated = await updateDeviceForContext(context, device.id, {
        nickname: s('nickname'),
        manufacturer: s('manufacturer'),
        model: s('model'),
        serial_number: s('serial_number'),
        battery_type: s('battery_type'),
        setup_instructions: s('setup_instructions'),
        reset_instructions: s('reset_instructions'),
        troubleshooting_notes: s('troubleshooting_notes'),
        handover_notes: s('handover_notes'),
        notes: s('notes'),
        is_critical: Boolean(editForm.is_critical)
      });
      if (updated) setDevice(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save changes.');
    } finally {
      setActing(false);
    }
  };

  const addCloudDep = async () => {
    if (!context || !device || !cloudDep.trim()) return;
    setActing(true);
    setError('');
    try {
      await createRelationshipForContext(context, {
        source_type: 'device',
        source_id: device.id,
        target_type: 'cloud_service',
        target_label: cloudDep.trim(),
        relationship_type: 'depends_on'
      });
      await reloadDependencies(context, device.id);
      setCloudDep('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add dependency.');
    } finally {
      setActing(false);
    }
  };

  const removeDep = async (relationshipId: string) => {
    if (!context || !device) return;
    setActing(true);
    try {
      await deleteRelationshipForContext(context, relationshipId);
      await reloadDependencies(context, device.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove dependency.');
    } finally {
      setActing(false);
    }
  };

  const remove = async () => {
    if (!context || !device) return;
    if (!window.confirm(`Remove "${device.nickname || device.name}" from your smart home records?`)) return;
    setActing(true);
    try {
      await deleteDeviceForContext(context, device.id);
      router.push('/automation/devices');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete device.');
      setActing(false);
    }
  };

  if (loading) {
    return (<><PageHeader title="Device" /><Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p></Card></>);
  }

  if (error || !device) {
    return (
      <>
        <PageHeader title={error ? 'Could not load this device' : 'Device not found'} />
        <Card>
          {error ? <p style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p> : null}
          <ActionLink href="/automation/devices" variant="secondary">Back to devices</ActionLink>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Smart Home device"
        title={device.nickname || device.name}
        description={[formatEnumLabel(device.category), device.manufacturer, device.model].filter(Boolean).join(' · ')}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <UtilityBadge label={AUTOMATION_STATUS_LABELS[device.status]} />
          {device.is_critical ? <UtilityBadge label="Critical" tone="attention" /> : null}
          {device.internet_required ? <UtilityBadge label="Needs internet" /> : <UtilityBadge label="Works locally" tone="good" />}
          <UtilityBadge label={`${completeness}% documented`} tone={completeness >= 80 ? 'good' : 'attention'} />
          {context?.mode === 'supabase' && !editing ? (
            <Button variant="secondary" onClick={startEdit}>Edit details</Button>
          ) : null}
        </div>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        {editing ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Edit details</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <label><span>Nickname</span><Input value={String(editForm.nickname ?? '')} onChange={(e) => setEditForm((f) => ({ ...f, nickname: e.target.value }))} style={{ marginTop: 6 }} /></label>
                <label><span>Manufacturer</span><Input value={String(editForm.manufacturer ?? '')} onChange={(e) => setEditForm((f) => ({ ...f, manufacturer: e.target.value }))} style={{ marginTop: 6 }} /></label>
                <label><span>Model</span><Input value={String(editForm.model ?? '')} onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))} style={{ marginTop: 6 }} /></label>
                <label><span>Serial number</span><Input value={String(editForm.serial_number ?? '')} onChange={(e) => setEditForm((f) => ({ ...f, serial_number: e.target.value }))} style={{ marginTop: 6 }} /></label>
                <label><span>Battery type</span><Input value={String(editForm.battery_type ?? '')} onChange={(e) => setEditForm((f) => ({ ...f, battery_type: e.target.value }))} style={{ marginTop: 6 }} /></label>
                <label><span>Firmware</span><Input value={String(editForm.firmware_version ?? '')} onChange={(e) => setEditForm((f) => ({ ...f, firmware_version: e.target.value }))} style={{ marginTop: 6 }} /></label>
              </div>
              <label><span>Setup instructions</span><textarea value={String(editForm.setup_instructions ?? '')} onChange={(e) => setEditForm((f) => ({ ...f, setup_instructions: e.target.value }))} style={{ width: '100%', minHeight: 54, marginTop: 6, padding: 10 }} /></label>
              <label><span>Reset instructions</span><textarea value={String(editForm.reset_instructions ?? '')} onChange={(e) => setEditForm((f) => ({ ...f, reset_instructions: e.target.value }))} style={{ width: '100%', minHeight: 54, marginTop: 6, padding: 10 }} /></label>
              <label><span>Troubleshooting</span><textarea value={String(editForm.troubleshooting_notes ?? '')} onChange={(e) => setEditForm((f) => ({ ...f, troubleshooting_notes: e.target.value }))} style={{ width: '100%', minHeight: 54, marginTop: 6, padding: 10 }} /></label>
              <label><span>Handover notes</span><textarea value={String(editForm.handover_notes ?? '')} onChange={(e) => setEditForm((f) => ({ ...f, handover_notes: e.target.value }))} style={{ width: '100%', minHeight: 54, marginTop: 6, padding: 10 }} /></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={Boolean(editForm.is_critical)} onChange={(e) => setEditForm((f) => ({ ...f, is_critical: e.target.checked }))} />
                <span>Critical device</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={saveEdit} disabled={acting}>{acting ? 'Saving…' : 'Save changes'}</Button>
                <Button variant="secondary" onClick={() => setEditing(false)} disabled={acting}>Cancel</Button>
              </div>
            </div>
          </Card>
        ) : null}

        <Card>
          <h2 style={{ marginTop: 0 }}>Status</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Select aria-label="Device status" value={device.status} onChange={(e) => changeStatus(e.target.value as AutomationDeviceStatus)} disabled={acting} style={{ maxWidth: 220 }}>
              {AUTOMATION_DEVICE_STATUSES.map((s) => (
                <option key={s} value={s}>{AUTOMATION_STATUS_LABELS[s]}</option>
              ))}
            </Select>
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              {device.last_checked_date ? `Last checked ${device.last_checked_date}` : 'Not checked yet'}
            </span>
          </div>
          {error ? <p style={{ color: 'var(--status-urgent)', fontWeight: 700, marginBottom: 0 }}>{error}</p> : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>How it connects</h2>
          <Row label="Connects via" value={device.primary_protocol ? formatEnumLabel(device.primary_protocol) : 'Not recorded'} />
          <Row label="Through hub" value={hubName || 'Directly (no hub)'} />
          <Row label="On network" value={networkName || null} />
          <Row label="Works without internet" value={device.local_control_available && !device.internet_required ? 'Yes' : 'No — needs internet'} />
          <Row label="Power" value={device.power_type ? formatEnumLabel(device.power_type) : null} />
          <Row label="Battery" value={device.battery_type ? `${device.battery_type}${device.last_battery_replacement ? ` · last changed ${device.last_battery_replacement}` : ''}` : null} />
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Details</h2>
          <Row label="Room" value={device.room_id ? rooms.get(device.room_id) : 'No room assigned'} />
          <Row label="Serial number" value={device.serial_number ? <span style={{ fontFamily: 'var(--font-mono)' }}>{device.serial_number}</span> : null} />
          <Row label="Firmware" value={device.firmware_version} />
          <Row label="Warranty ends" value={device.warranty_expiration} />
          <Row label="Notes" value={device.notes} />
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Setup, reset &amp; handover</h2>
          <Row label="Setup" value={device.setup_instructions || 'Not recorded'} />
          <Row label="Reset" value={device.reset_instructions || (device.is_critical ? '⚠ No reset steps recorded' : 'Not recorded')} />
          <Row label="Troubleshooting" value={device.troubleshooting_notes} />
          <Row label="Handover notes" value={device.handover_notes} />
          {device.credential_reference ? (
            <Row label="Credentials" value={<span>Stored in: <strong>{device.credential_reference}</strong> <span style={{ color: 'var(--text-muted)' }}>(reference only — no secret is saved here)</span></span>} />
          ) : null}
        </Card>

        {context?.mode === 'supabase' ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Automations &amp; dependencies</h2>
            {relatedAutomations.length > 0 ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>In these automations</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {relatedAutomations.map((a) => (
                    <Link key={a.id} href={`/automation/automations/${a.id}`} style={{ textDecoration: 'none' }}><UtilityBadge label={a.name} /></Link>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Depends on a cloud service</div>
              {dependencies.length > 0 ? (
                <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
                  {dependencies.map((d) => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4 }}>
                      <span>{d.label}</span>
                      <button type="button" onClick={() => removeDep(d.id)} disabled={acting} aria-label="Remove dependency" style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--status-urgent)' }}>×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', margin: '0 0 10px', fontSize: 14 }}>None recorded. Add a cloud service this device needs (e.g. Ring Cloud) so the failure guide can warn about it.</p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
                <label style={{ flex: '1 1 220px' }}>
                  <span>Cloud service it depends on</span>
                  <Input value={cloudDep} onChange={(e) => setCloudDep(e.target.value)} placeholder="Ring Cloud" style={{ marginTop: 6 }} />
                </label>
                <Button variant="secondary" onClick={addCloudDep} disabled={acting || !cloudDep.trim()}>Add dependency</Button>
              </div>
            </div>
          </Card>
        ) : null}

        <Card>
          <h2 style={{ marginTop: 0 }}>Linked records</h2>
          {linked ? (
            <div style={{ display: 'grid', gap: 14 }}>
              <LinkedGroup title="Documents" items={linked.documents} empty="No documents attached." />
              <LinkedGroup title="Open & past issues" items={linked.issues} empty="No issues logged." />
              <LinkedGroup title="Repairs" items={linked.repairs} empty="No repairs logged." />
              <LinkedGroup title="Receipts" items={linked.receipts} empty="No receipts attached." />
              <LinkedGroup title="Service history" items={linked.serviceRecords} empty="No service history." />
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Sign in to see linked records.</p>
          )}
        </Card>

        {context?.mode === 'supabase' ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Report a problem</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>Creates an issue or repair already linked to this device.</p>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
                <label style={{ flex: '1 1 220px' }}><span>Issue</span><Input value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} placeholder="Keeps disconnecting from Wi-Fi" style={{ marginTop: 6 }} /></label>
                <Button variant="secondary" onClick={reportIssue} disabled={acting}>Report issue</Button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
                <label style={{ flex: '1 1 220px' }}><span>Repair</span><Input value={repairTitle} onChange={(e) => setRepairTitle(e.target.value)} placeholder="Replace lock motor" style={{ marginTop: 6 }} /></label>
                <Button variant="secondary" onClick={logRepair} disabled={acting}>Log repair</Button>
              </div>
            </div>
            {quickMsg ? <p style={{ color: 'var(--status-good)', fontWeight: 700, marginBottom: 0 }}>{quickMsg}</p> : null}
          </Card>
        ) : null}

        <Card>
          <h2 style={{ marginTop: 0 }}>Manage</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ActionLink href={`/documents?automationDeviceId=${device.id}`} variant="secondary">Add document</ActionLink>
            <Button variant="secondary" onClick={remove} disabled={acting} style={{ color: 'var(--status-urgent)', borderColor: 'var(--status-urgent)' }}>
              {acting ? 'Working…' : 'Remove device'}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
