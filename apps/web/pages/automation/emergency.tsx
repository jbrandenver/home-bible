import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-folder/shared';
import { Button, Card, EmptyState, PageHeader, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import {
  getAutomationContext,
  getDevicesForContext,
  getHubsForContext,
  getNetworksForContext,
  getRoutinesForContext,
  type AutomationDataMode,
  type AutomationDeviceRow,
  type AutomationHubRow,
  type AutomationNetworkRow,
  type AutomationRoutineRow
} from '../../lib/automation';
import { buildEmergencyGuide, type EmergencyDevice, type EmergencyGuide } from '../../lib/automationEmergency';
import {
  buildJsonExport,
  devicesToCsv,
  downloadTextFile,
  hubsToCsv,
  networksToCsv,
  routinesToCsv
} from '../../lib/automationExport';
import { getRoomsForProperty } from '../../lib/rooms';
import { formatRoomLocation } from '../../lib/roomLabels';

type Room = { id: string; name: string; room_type?: string | null; floor_name?: string | null };

function DeviceLines({ items, empty }: { items: EmergencyDevice[]; empty: string }) {
  if (items.length === 0) return <p style={{ color: 'var(--text-muted)', margin: 0 }}>{empty}</p>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((d) => (
        <div key={d.id} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
          <strong>{d.name}</strong>
          <span style={{ color: 'var(--text-muted)' }}>{d.location ? ` — ${d.location}` : ''}</span>
          {d.worksLocally ? <span style={{ color: 'var(--status-good)', fontSize: 13 }}> · works without internet</span> : <span style={{ color: 'var(--color-brass-deep)', fontSize: 13 }}> · needs internet</span>}
          {d.reset ? <div style={{ fontSize: 14, marginTop: 2 }}><em>Reset:</em> {d.reset}</div> : null}
          {d.handover ? <div style={{ fontSize: 14, marginTop: 2, color: 'var(--text-muted)' }}>{d.handover}</div> : null}
        </div>
      ))}
    </div>
  );
}

export default function AutomationEmergencyPage() {
  const [dataMode, setDataMode] = useState<AutomationDataMode>('demo');
  const [propertyName, setPropertyName] = useState('Home');
  const [devices, setDevices] = useState<AutomationDeviceRow[]>([]);
  const [hubs, setHubs] = useState<AutomationHubRow[]>([]);
  const [networks, setNetworks] = useState<AutomationNetworkRow[]>([]);
  const [routines, setRoutines] = useState<AutomationRoutineRow[]>([]);
  const [rooms, setRooms] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [includeCreds, setIncludeCreds] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const context = await getAutomationContext();
        let roomMap = new Map<string, string>();
        const [d, h, n, r] = await Promise.all([
          getDevicesForContext(context),
          getHubsForContext(context),
          getNetworksForContext(context),
          getRoutinesForContext(context)
        ]);
        if (context.mode === 'supabase' && context.property) {
          const roomList = await getRoomsForProperty(context.property.id);
          roomMap = new Map((roomList as Room[]).map((room) => [room.id, formatRoomLocation(room)]));
        }
        if (!isMounted) return;
        setDataMode(context.mode);
        setPropertyName(context.property?.nickname || 'Home');
        setDevices(d);
        setHubs(h);
        setNetworks(n);
        setRoutines(r);
        setRooms(roomMap);
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : 'Failed to build the guide.');
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

  const guide: EmergencyGuide | null = useMemo(() => {
    if (dataMode !== 'supabase') return null;
    return buildEmergencyGuide({
      propertyName,
      devices,
      hubs,
      networks,
      routines,
      roomLabel: (roomId) => (roomId ? rooms.get(roomId) ?? null : null)
    });
  }, [dataMode, propertyName, devices, hubs, networks, routines, rooms]);

  const exportOptions = { includeCredentialReferences: includeCreds };
  const generatedAt = new Date().toISOString();

  const handleCsv = () => {
    const parts = [
      '# DEVICES', devicesToCsv(devices, exportOptions), '',
      '# HUBS', hubsToCsv(hubs, exportOptions), '',
      '# NETWORKS', networksToCsv(networks, exportOptions), '',
      '# AUTOMATIONS', routinesToCsv(routines)
    ];
    downloadTextFile('home-folder-smart-home.csv', parts.join('\n'), 'text/csv');
  };

  const handleJson = () => {
    downloadTextFile('home-folder-smart-home.json', buildJsonExport({ propertyName, devices, hubs, networks, routines }, exportOptions, generatedAt), 'application/json');
  };

  if (loading) {
    return (<><PageHeader title="Emergency & handover" /><Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>Assembling the guide…</p></Card></>);
  }
  if (dataMode !== 'supabase' || !guide) {
    return (
      <>
        <PageHeader title="Emergency & handover" />
        {error ? <Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>{error}</p></Card> : null}
        <EmptyState title="Sign in to build the guide" description="The emergency and handover guide is generated from your recorded smart home data." />
      </>
    );
  }

  return (
    <>
      <div className="print-hide">
        <PageHeader
          eyebrow="Smart Home"
          title="Emergency & handover"
          description="A calm, print-friendly guide for anyone operating the home — family, a house sitter, a technician, or a new owner. Passwords and codes are never included."
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button onClick={() => window.print()}>Print</Button>
            <Button variant="secondary" onClick={handleCsv}>Export CSV</Button>
            <Button variant="secondary" onClick={handleJson}>Export JSON</Button>
            <ActionLink href="/automation" variant="secondary">Back</ActionLink>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <input type="checkbox" checked={includeCreds} onChange={(e) => setIncludeCreds(e.target.checked)} />
              <span>Include credential-reference names in exports</span>
            </label>
          </div>
        </PageHeader>
      </div>

      <div className="print-only" style={{ marginBottom: 16 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', margin: 0 }}>Our Home Folder — Smart Home Emergency & Handover</p>
        <h1 style={{ margin: '4px 0 2px' }}>{guide.propertyName}</h1>
        <div className="hb-double-rule" style={{ marginTop: 10 }} />
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        <Card tone="dark">
          <h2 style={{ marginTop: 0 }}>Safety first</h2>
          <p style={{ marginBottom: 0 }}>
            In an emergency, protect people first. Locate the main water shut-off and electrical panel (see Home → Utilities).
            Passwords and codes are intentionally not printed here — they live in the household password manager.
          </p>
        </Card>

        <Card><h2 style={{ marginTop: 0 }}>Critical safety devices</h2><DeviceLines items={guide.criticalSafety} empty="No smoke, CO, leak, or water-shutoff devices recorded." /></Card>
        <Card><h2 style={{ marginTop: 0 }}>Locks &amp; entry</h2><DeviceLines items={guide.locks} empty="No smart locks recorded. Use physical keys." /></Card>
        <Card><h2 style={{ marginTop: 0 }}>Security &amp; cameras</h2><DeviceLines items={guide.security} empty="No security devices recorded." /></Card>
        {guide.garage.length > 0 ? <Card><h2 style={{ marginTop: 0 }}>Garage access</h2><DeviceLines items={guide.garage} empty="" /></Card> : null}

        <Card>
          <h2 style={{ marginTop: 0 }}>If devices go offline — restart order</h2>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {guide.networkRestart.map((n) => (
              <li key={n.name} style={{ marginBottom: 6 }}><strong>{n.name}</strong> (network){n.recovery ? ` — ${n.recovery}` : ''}</li>
            ))}
            {guide.hubRestartOrder.map((h) => (
              <li key={h.name} style={{ marginBottom: 6 }}><strong>{h.name}</strong> ({formatEnumLabel(h.type)}){h.recovery ? ` — ${h.recovery}` : ''}</li>
            ))}
          </ol>
          {guide.networkRestart.length === 0 && guide.hubRestartOrder.length === 0 ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>No networks or hubs recorded.</p> : null}
        </Card>

        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <Card>
            <h2 style={{ marginTop: 0 }}>Works without internet</h2>
            {guide.worksLocally.length === 0 ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>None recorded.</p> : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{guide.worksLocally.map((n) => <UtilityBadge key={n} label={n} tone="good" />)}</div>
            )}
          </Card>
          <Card>
            <h2 style={{ marginTop: 0 }}>Stops without internet</h2>
            {guide.needsInternet.length === 0 ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>None recorded.</p> : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{guide.needsInternet.map((n) => <UtilityBadge key={n} label={n} tone="attention" />)}</div>
            )}
          </Card>
        </div>

        {guide.criticalAutomations.length > 0 ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Critical automations</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {guide.criticalAutomations.map((a) => (
                <div key={a.name} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <strong>{a.name}</strong>
                  {a.manualOverride ? <div style={{ fontSize: 14 }}><em>Manual override:</em> {a.manualOverride}</div> : null}
                  {a.failureBehavior ? <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>If it fails: {a.failureBehavior}</div> : null}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card className="hb-cover">
          <div className="hb-cover-inner">
            <h2 style={{ marginTop: 0 }}>What to do when…</h2>
            <div style={{ display: 'grid', gap: 16 }}>
              {guide.playbooks.map((pb) => (
                <div key={pb.title}>
                  <h3 style={{ margin: '0 0 6px' }}>{pb.title}</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {pb.steps.map((step, i) => <li key={i} style={{ marginBottom: 4 }}>{step}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <footer style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          Generated from Our Home Folder · Passwords, codes, and secrets are excluded by design.
        </footer>
      </div>
    </>
  );
}
