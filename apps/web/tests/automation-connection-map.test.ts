import { describe, expect, it } from 'vitest';
import { buildConnectionMap, mapToListGroups, neighborsOf } from '../lib/connectionMap';
import type { FailureGraph } from '../lib/failureImpact';
import type { AutomationDeviceRow, AutomationHubRow, AutomationNetworkRow } from '../lib/automation';

function device(p: Partial<AutomationDeviceRow> & { id: string; name: string }): AutomationDeviceRow {
  return {
    property_id: 'p1', floor_id: null, room_id: null, primary_hub_id: null, primary_network_id: null,
    parent_device_id: null, nickname: null, category: 'other', manufacturer: null, model: null,
    serial_number: null, status: 'online', is_critical: false, indoor_outdoor: 'indoor',
    primary_protocol: null, power_type: 'mains', battery_type: null, last_battery_replacement: null,
    circuit_reference: null, internet_required: false, local_control_available: true, firmware_version: null,
    warranty_expiration: null, purchase_price: null, setup_instructions: null, reset_instructions: null,
    troubleshooting_notes: null, handover_notes: null, credential_reference: null, notes: null,
    last_checked_date: null, retired_date: null, created_at: '2026-01-01', updated_at: '2026-01-01',
    deleted_at: null, ...p
  };
}
function hub(p: Partial<AutomationHubRow> & { id: string; name: string }): AutomationHubRow {
  return {
    property_id: 'p1', room_id: null, network_id: null, manufacturer: null, model: null, hub_type: 'bridge',
    local_control: true, cloud_dependency: false, internet_dependency: false, criticality: 'normal',
    status: 'online', firmware_version: null, recovery_steps: null, reset_instructions: null,
    credential_reference: null, notes: null, created_at: '2026-01-01', updated_at: '2026-01-01', deleted_at: null, ...p
  };
}
function network(p: Partial<AutomationNetworkRow> & { id: string; name: string }): AutomationNetworkRow {
  return {
    property_id: 'p1', network_type: 'wifi', ssid: null, internet_provider: null, is_guest: false, is_iot: false,
    physical_location: null, recovery_instructions: null, credential_reference: null, notes: null,
    created_at: '2026-01-01', updated_at: '2026-01-01', deleted_at: null, ...p
  };
}

const base = (): FailureGraph => ({ devices: [], hubs: [], networks: [], routines: [], routineDevices: [], deviceHubs: [], deviceNetworks: [], relationships: [] });

describe('connection map', () => {
  it('groups devices by room in physical view', () => {
    const graph = base();
    graph.devices = [device({ id: 'a', name: 'Lamp', room_id: 'living' }), device({ id: 'b', name: 'Fan', room_id: 'living' })];
    const map = buildConnectionMap('physical', { graph, deviceEcosystems: [], roomLabel: () => 'Living Room' });
    const groups = mapToListGroups(map);
    expect(groups[0].anchor.label).toBe('Living Room');
    expect(groups[0].members).toHaveLength(2);
  });

  it('produces hub+network anchors and cloud node in network view; no overlapping ids', () => {
    const graph = base();
    graph.hubs = [hub({ id: 'hue', name: 'Hue Bridge', network_id: 'wifi' })];
    graph.networks = [network({ id: 'wifi', name: 'Home Wi-Fi' })];
    graph.devices = [device({ id: 'bulb', name: 'Bulb', primary_hub_id: 'hue', primary_network_id: 'wifi', internet_required: true })];
    const map = buildConnectionMap('network', { graph, deviceEcosystems: [], roomLabel: () => null });
    const ids = new Set(map.right.map((n) => n.id));
    expect(ids.has('hub:hue')).toBe(true);
    expect(ids.has('network:wifi')).toBe(true);
    expect(ids.has('internet:cloud')).toBe(true);
    // deterministic + de-duped edges
    const edgeKeys = map.edges.map((e) => `${e.from}->${e.to}`);
    expect(new Set(edgeKeys).size).toBe(edgeKeys.length);
    // highlight includes the bulb's neighbors
    const n = neighborsOf(map, 'device:bulb');
    expect(n.has('hub:hue')).toBe(true);
    expect(n.has('internet:cloud')).toBe(true);
  });

  it('automation view flips left to automations', () => {
    const graph = base();
    graph.devices = [device({ id: 'lock', name: 'Lock' })];
    graph.routines = [{ id: 'r1', property_id: 'p1', name: 'Lock up', routine_type: 'security', description: null, platform: null, status: 'active', criticality: 'high', trigger_text: null, conditions_text: null, actions_text: null, internet_dependency: false, local_control_available: true, failure_behavior: null, manual_override: null, last_tested: null, notes: null, created_at: '2026-01-01', updated_at: '2026-01-01', deleted_at: null }];
    graph.routineDevices = [{ routine_id: 'r1', device_id: 'lock' }];
    const map = buildConnectionMap('automation', { graph, deviceEcosystems: [], roomLabel: () => null });
    expect(map.left[0].kind).toBe('automation');
    expect(map.right.some((n) => n.id === 'device:lock')).toBe(true);
  });
});
