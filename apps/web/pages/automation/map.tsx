import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card, EmptyState, PageHeader, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import {
  getAutomationContext,
  getDeviceEcosystemLinksForContext,
  getDeviceHubLinksForContext,
  getDeviceNetworkLinksForContext,
  getDevicesForContext,
  getHubsForContext,
  getNetworksForContext,
  getRelationshipsForContext,
  getRoutineDeviceLinksForContext,
  getRoutinesForContext,
  type AutomationDataMode
} from '../../lib/automation';
import type { FailureGraph } from '../../lib/failureImpact';
import {
  buildConnectionMap,
  mapToListGroups,
  neighborsOf,
  type MapNode,
  type MapViewMode
} from '../../lib/connectionMap';
import { getRoomsForProperty } from '../../lib/rooms';
import { formatRoomLocation } from '../../lib/roomLabels';

type Room = { id: string; name: string; room_type?: string | null; floor_name?: string | null };

const VIEWS: Array<{ mode: MapViewMode; label: string }> = [
  { mode: 'physical', label: 'By room' },
  { mode: 'network', label: 'Network' },
  { mode: 'protocol', label: 'Protocol' },
  { mode: 'ecosystem', label: 'Ecosystem' },
  { mode: 'automation', label: 'Automations' },
  { mode: 'failure', label: 'Failure impact' }
];

const NODE_COLORS: Record<string, string> = {
  device: 'var(--surface-card-raised)',
  hub: 'var(--color-brass-pale)',
  network: 'var(--color-sand)',
  room: 'var(--surface-card)',
  protocol: 'var(--surface-card)',
  ecosystem: 'var(--surface-card)',
  automation: 'var(--color-brass-pale)',
  internet: 'var(--color-clay)'
};

export default function ConnectionMapPage() {
  const [dataMode, setDataMode] = useState<AutomationDataMode>('demo');
  const [graph, setGraph] = useState<FailureGraph | null>(null);
  const [deviceEcosystems, setDeviceEcosystems] = useState<Array<{ device_id: string; ecosystem: string }>>([]);
  const [rooms, setRooms] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<MapViewMode>('physical');
  const [view, setView] = useState<'map' | 'list'>('list');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const context = await getAutomationContext();
        let roomMap = new Map<string, string>();
        const [devices, hubs, networks, routines, routineDevices, deviceHubs, deviceNetworks, relationships, ecosystems] =
          await Promise.all([
            getDevicesForContext(context),
            getHubsForContext(context),
            getNetworksForContext(context),
            getRoutinesForContext(context),
            getRoutineDeviceLinksForContext(context),
            getDeviceHubLinksForContext(context),
            getDeviceNetworkLinksForContext(context),
            getRelationshipsForContext(context),
            getDeviceEcosystemLinksForContext(context)
          ]);
        if (context.mode === 'supabase' && context.property) {
          const roomList = await getRoomsForProperty(context.property.id);
          roomMap = new Map((roomList as Room[]).map((room) => [room.id, formatRoomLocation(room)]));
        }
        if (!isMounted) return;
        setDataMode(context.mode);
        setRooms(roomMap);
        setDeviceEcosystems(ecosystems);
        setGraph({
          devices,
          hubs,
          networks,
          routines,
          routineDevices: routineDevices.map((l) => ({ routine_id: l.routine_id, device_id: l.device_id })),
          deviceHubs: deviceHubs.map((l) => ({ device_id: l.device_id, hub_id: l.hub_id, is_required: l.is_required })),
          deviceNetworks: deviceNetworks.map((l) => ({ device_id: l.device_id, network_id: l.network_id })),
          relationships
        });
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load the map.');
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

  const map = useMemo(() => {
    if (!graph) return null;
    return buildConnectionMap(mode, { graph, deviceEcosystems, roomLabel: (id) => (id ? rooms.get(id) ?? null : null) });
  }, [graph, mode, deviceEcosystems, rooms]);

  const listGroups = useMemo(() => (map ? mapToListGroups(map) : []), [map]);
  const highlight = useMemo(() => (map && selected ? neighborsOf(map, selected) : null), [map, selected]);

  // Deterministic bipartite layout for the SVG map.
  const layout = useMemo(() => {
    if (!map) return null;
    const rowH = 46;
    const nodeW = 190;
    const nodeH = 34;
    const colGap = 260;
    const leftX = 12;
    const rightX = leftX + nodeW + colGap;
    const rows = Math.max(map.left.length, map.right.length);
    const height = Math.max(120, rows * rowH + 20);
    const width = rightX + nodeW + 12;
    const pos = new Map<string, { x: number; y: number }>();
    map.left.forEach((n, i) => pos.set(n.id, { x: leftX, y: 12 + i * rowH }));
    map.right.forEach((n, i) => pos.set(n.id, { x: rightX, y: 12 + i * rowH }));
    return { pos, width, height, nodeW, nodeH, leftX, rightX };
  }, [map]);

  const nodeVisible = (id: string) => !highlight || highlight.has(id);

  return (
    <>
      <PageHeader
        eyebrow="Smart Home"
        title="Connection map"
        description="See how devices connect — by room, network, protocol, ecosystem, or automation — and what depends on what."
      >
        <ActionLink href="/automation" variant="secondary">Overview</ActionLink>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        {error ? <Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>{error}</p></Card> : null}

        {loading ? (
          <Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>Building the map…</p></Card>
        ) : dataMode === 'demo' ? (
          <EmptyState title="Sign in to see the connection map" description="The map is built from your recorded devices, hubs, networks, and automations." />
        ) : !map || (map.left.length === 0 && map.right.length === 0) ? (
          <EmptyState title="Nothing to map yet" description="Add devices, hubs, and networks to see how everything connects." />
        ) : (
          <>
            <Card>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {VIEWS.map((v) => (
                    <button
                      key={v.mode}
                      type="button"
                      onClick={() => { setMode(v.mode); setSelected(null); }}
                      className="shortcut-link"
                      style={{ border: '1px solid var(--border-subtle)', background: mode === v.mode ? 'var(--color-brass-pale)' : 'transparent', color: 'var(--color-ink)' }}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => setView('list')} className="shortcut-link" style={{ border: '1px solid var(--border-subtle)', background: view === 'list' ? 'var(--color-brass-pale)' : 'transparent', color: 'var(--color-ink)' }}>List</button>
                  <button type="button" onClick={() => setView('map')} className="shortcut-link" style={{ border: '1px solid var(--border-subtle)', background: view === 'map' ? 'var(--color-brass-pale)' : 'transparent', color: 'var(--color-ink)' }}>Map</button>
                </div>
              </div>
              {selected ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 0, marginTop: 12 }}>
                  Highlighting connections for the selected item. <button type="button" onClick={() => setSelected(null)} style={{ background: 'transparent', border: 0, color: 'var(--color-brass-deep)', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
                </p>
              ) : null}
            </Card>

            {view === 'list' ? (
              <div style={{ display: 'grid', gap: 16 }}>
                {listGroups.length === 0 ? (
                  <Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>No connections recorded for this view yet.</p></Card>
                ) : (
                  listGroups.map((group) => (
                    <Card key={group.anchor.id}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <h2 style={{ margin: 0 }}>{group.anchor.label}</h2>
                        <UtilityBadge label={group.anchor.kind === 'internet' ? 'Cloud / Internet' : group.anchor.sublabel || group.anchor.kind} />
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{group.members.length} connected</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                        {group.members.map((m) => (
                          <NodeChip key={m.id} node={m} />
                        ))}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            ) : (
              <Card style={{ overflowX: 'auto' }}>
                {layout ? (
                  <svg
                    role="img"
                    aria-label="Connection map"
                    width={layout.width}
                    height={layout.height}
                    style={{ minWidth: layout.width, fontFamily: 'var(--font-ui)' }}
                  >
                    {map.edges.map((edge, i) => {
                      const a = layout.pos.get(edge.from);
                      const b = layout.pos.get(edge.to);
                      if (!a || !b) return null;
                      const active = !highlight || (highlight.has(edge.from) && highlight.has(edge.to));
                      return (
                        <line
                          key={i}
                          x1={a.x + layout.nodeW}
                          y1={a.y + layout.nodeH / 2}
                          x2={b.x}
                          y2={b.y + layout.nodeH / 2}
                          stroke={active ? 'var(--color-brass-deep)' : 'var(--border-subtle)'}
                          strokeWidth={active ? 1.5 : 0.75}
                          opacity={active ? 0.8 : 0.25}
                        />
                      );
                    })}
                    {[...map.left, ...map.right].map((node) => {
                      const p = layout.pos.get(node.id);
                      if (!p) return null;
                      const visible = nodeVisible(node.id);
                      return (
                        <g key={node.id} transform={`translate(${p.x},${p.y})`} onClick={() => setSelected(node.id === selected ? null : node.id)} style={{ cursor: 'pointer' }}>
                          <rect
                            width={layout.nodeW}
                            height={layout.nodeH}
                            rx={4}
                            fill={NODE_COLORS[node.kind] || 'var(--surface-card)'}
                            stroke={node.id === selected ? 'var(--color-brass-deep)' : node.isCritical ? 'var(--status-urgent)' : 'var(--border-subtle)'}
                            strokeWidth={node.id === selected ? 2 : 1}
                            opacity={visible ? 1 : 0.3}
                          />
                          <text x={8} y={21} fontSize={12} fill="var(--color-ink)" opacity={visible ? 1 : 0.4}>
                            {node.label.length > 24 ? `${node.label.slice(0, 23)}…` : node.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                ) : null}
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 0 }}>
                  Tap any box to highlight its connections. Devices are on the left; what they connect to is on the right.
                </p>
              </Card>
            )}

            {mode === 'failure' ? (
              <Card tone="dark">
                <h2 style={{ marginTop: 0 }}>See exactly what fails</h2>
                <p style={{ marginBottom: 0 }}>
                  For a full impact report — affected devices, automations, safety functions, and recovery steps — open{' '}
                  <Link href="/automation/failure-impact" style={{ color: 'var(--color-brass-pale)' }}>What fails if…</Link>.
                </p>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

function NodeChip({ node }: { node: MapNode }) {
  const href =
    node.kind === 'device' ? `/automation/devices/${node.id.split(':')[1]}` : node.kind === 'automation' ? `/automation/automations/${node.id.split(':')[1]}` : null;
  const content = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: `1px solid ${node.isCritical ? 'var(--status-urgent)' : 'var(--border-subtle)'}`,
        borderRadius: 4,
        padding: '4px 10px',
        fontSize: 14,
        background: NODE_COLORS[node.kind] || 'var(--surface-card)'
      }}
    >
      {node.label}
      {node.isCritical ? <span style={{ color: 'var(--status-urgent)', fontSize: 11 }}>critical</span> : null}
    </span>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link> : content;
}
