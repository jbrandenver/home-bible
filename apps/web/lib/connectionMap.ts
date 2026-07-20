// Connection map model — pure and testable. Turns the recorded automation
// graph into a bipartite node/edge structure for a given view mode, plus a
// grouped structure for the accessible list view. Layout is deterministic
// (index-based), so nodes never overlap and there's no randomness/animation.

import { formatEnumLabel } from '@home-folder/shared';
import type { FailureGraph } from './failureImpact';

export type MapViewMode = 'physical' | 'network' | 'protocol' | 'ecosystem' | 'automation' | 'failure';

export type MapNodeKind = 'device' | 'hub' | 'network' | 'room' | 'protocol' | 'ecosystem' | 'automation' | 'internet';

export type MapNode = {
  id: string;
  kind: MapNodeKind;
  label: string;
  sublabel?: string;
  isCritical?: boolean;
};

export type MapEdge = { from: string; to: string };

export type ConnectionMap = {
  left: MapNode[]; // devices (or automations in automation mode)
  right: MapNode[]; // anchors: rooms / hubs+networks / protocols / ecosystems / devices
  edges: MapEdge[];
};

export type MapListGroup = { anchor: MapNode; members: MapNode[] };

export type MapInputs = {
  graph: FailureGraph;
  deviceEcosystems: Array<{ device_id: string; ecosystem: string }>;
  roomLabel: (roomId: string | null) => string | null;
};

function activeDevices(graph: FailureGraph) {
  return graph.devices.filter((d) => !d.deleted_at && d.status !== 'retired');
}

function deviceNode(d: FailureGraph['devices'][number]): MapNode {
  return { id: `device:${d.id}`, kind: 'device', label: d.nickname || d.name, sublabel: formatEnumLabel(d.category), isCritical: d.is_critical };
}

export function buildConnectionMap(mode: MapViewMode, inputs: MapInputs): ConnectionMap {
  const { graph, deviceEcosystems, roomLabel } = inputs;
  const devices = activeDevices(graph);
  const left: MapNode[] = devices.map(deviceNode);
  const right: MapNode[] = [];
  const edges: MapEdge[] = [];
  const rightSeen = new Set<string>();
  const addRight = (node: MapNode) => {
    if (!rightSeen.has(node.id)) {
      rightSeen.add(node.id);
      right.push(node);
    }
  };

  if (mode === 'physical') {
    for (const d of devices) {
      const label = roomLabel(d.room_id);
      const anchorId = d.room_id ? `room:${d.room_id}` : 'room:none';
      addRight({ id: anchorId, kind: 'room', label: label || 'No room assigned' });
      edges.push({ from: `device:${d.id}`, to: anchorId });
    }
  } else if (mode === 'protocol') {
    for (const d of devices) {
      const anchorId = d.primary_protocol ? `protocol:${d.primary_protocol}` : 'protocol:unknown';
      addRight({ id: anchorId, kind: 'protocol', label: d.primary_protocol ? formatEnumLabel(d.primary_protocol) : 'Unknown protocol' });
      edges.push({ from: `device:${d.id}`, to: anchorId });
    }
  } else if (mode === 'ecosystem') {
    const byDevice = new Map<string, string[]>();
    for (const link of deviceEcosystems) {
      const list = byDevice.get(link.device_id) ?? [];
      list.push(link.ecosystem);
      byDevice.set(link.device_id, list);
    }
    for (const d of devices) {
      const ecos = byDevice.get(d.id) ?? [];
      if (ecos.length === 0) {
        addRight({ id: 'ecosystem:none', kind: 'ecosystem', label: 'No ecosystem' });
        edges.push({ from: `device:${d.id}`, to: 'ecosystem:none' });
      }
      for (const eco of ecos) {
        const anchorId = `ecosystem:${eco}`;
        addRight({ id: anchorId, kind: 'ecosystem', label: formatEnumLabel(eco) });
        edges.push({ from: `device:${d.id}`, to: anchorId });
      }
    }
  } else if (mode === 'automation') {
    // left = automations, right = devices
    left.length = 0;
    const routineDeviceMap = new Map<string, Set<string>>();
    for (const link of graph.routineDevices) {
      const set = routineDeviceMap.get(link.routine_id) ?? new Set<string>();
      set.add(link.device_id);
      routineDeviceMap.set(link.routine_id, set);
    }
    for (const r of graph.routines.filter((x) => !x.deleted_at)) {
      left.push({ id: `automation:${r.id}`, kind: 'automation', label: r.name, sublabel: formatEnumLabel(r.routine_type) });
      for (const deviceId of routineDeviceMap.get(r.id) ?? []) {
        const d = devices.find((x) => x.id === deviceId);
        if (!d) continue;
        addRight(deviceNode(d));
        edges.push({ from: `automation:${r.id}`, to: `device:${d.id}` });
      }
    }
  } else {
    // network / failure: anchors = hubs and networks
    for (const hub of graph.hubs.filter((h) => !h.deleted_at)) {
      addRight({ id: `hub:${hub.id}`, kind: 'hub', label: hub.name, sublabel: formatEnumLabel(hub.hub_type) });
    }
    for (const net of graph.networks.filter((n) => !n.deleted_at)) {
      addRight({ id: `network:${net.id}`, kind: 'network', label: net.name, sublabel: formatEnumLabel(net.network_type) });
    }
    // cloud/internet anchor for cloud-dependent devices
    let internetUsed = false;
    for (const d of devices) {
      if (d.primary_hub_id) edges.push({ from: `device:${d.id}`, to: `hub:${d.primary_hub_id}` });
      if (d.primary_network_id) edges.push({ from: `device:${d.id}`, to: `network:${d.primary_network_id}` });
      if (d.internet_required) {
        internetUsed = true;
        edges.push({ from: `device:${d.id}`, to: 'internet:cloud' });
      }
    }
    for (const link of graph.deviceHubs) edges.push({ from: `device:${link.device_id}`, to: `hub:${link.hub_id}` });
    for (const link of graph.deviceNetworks) edges.push({ from: `device:${link.device_id}`, to: `network:${link.network_id}` });
    // hub → network edges (hub sits on a network)
    for (const hub of graph.hubs) {
      if (hub.network_id) edges.push({ from: `hub:${hub.id}`, to: `network:${hub.network_id}` });
    }
    if (internetUsed) addRight({ id: 'internet:cloud', kind: 'internet', label: 'Internet / Cloud' });
  }

  // de-dup edges
  const edgeSeen = new Set<string>();
  const dedupedEdges = edges.filter((e) => {
    const key = `${e.from}->${e.to}`;
    if (edgeSeen.has(key)) return false;
    edgeSeen.add(key);
    return true;
  });

  return { left, right, edges: dedupedEdges };
}

// Accessible list view: group left nodes under each right anchor they connect to.
export function mapToListGroups(map: ConnectionMap): MapListGroup[] {
  const leftById = new Map(map.left.map((n) => [n.id, n]));
  const groups = new Map<string, MapListGroup>();
  for (const anchor of map.right) groups.set(anchor.id, { anchor, members: [] });

  for (const edge of map.edges) {
    // edges go left->right except automation mode (automation->device). Normalize:
    const anchorId = groups.has(edge.to) ? edge.to : groups.has(edge.from) ? edge.from : null;
    const memberId = anchorId === edge.to ? edge.from : edge.to;
    if (!anchorId) continue;
    const member = leftById.get(memberId);
    if (member) groups.get(anchorId)!.members.push(member);
  }

  return Array.from(groups.values()).filter((g) => g.members.length > 0).sort((a, b) => b.members.length - a.members.length);
}

// Neighbors of a node (for highlight-on-select).
export function neighborsOf(map: ConnectionMap, nodeId: string): Set<string> {
  const set = new Set<string>([nodeId]);
  for (const edge of map.edges) {
    if (edge.from === nodeId) set.add(edge.to);
    if (edge.to === nodeId) set.add(edge.from);
  }
  return set;
}
