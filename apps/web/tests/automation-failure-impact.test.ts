import { describe, expect, it } from 'vitest';
import { computeFailureImpact, type FailureGraph } from '../lib/failureImpact';
import { computeAutomationOverview, deviceSetupCompleteness } from '../lib/automationOverview';
import type {
  AutomationDeviceRow,
  AutomationHubRow,
  AutomationNetworkRow,
  AutomationRoutineRow
} from '../lib/automation';

function device(partial: Partial<AutomationDeviceRow> & { id: string; name: string }): AutomationDeviceRow {
  return {
    property_id: 'p1',
    floor_id: null,
    room_id: null,
    primary_hub_id: null,
    primary_network_id: null,
    parent_device_id: null,
    nickname: null,
    category: 'other',
    manufacturer: null,
    model: null,
    serial_number: null,
    status: 'online',
    is_critical: false,
    indoor_outdoor: 'indoor',
    primary_protocol: null,
    power_type: 'mains',
    battery_type: null,
    last_battery_replacement: null,
    circuit_reference: null,
    internet_required: false,
    local_control_available: true,
    firmware_version: null,
    warranty_expiration: null,
    purchase_price: null,
    setup_instructions: null,
    reset_instructions: null,
    troubleshooting_notes: null,
    handover_notes: null,
    credential_reference: null,
    notes: null,
    last_checked_date: null,
    retired_date: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    deleted_at: null,
    ...partial
  };
}

function hub(partial: Partial<AutomationHubRow> & { id: string; name: string }): AutomationHubRow {
  return {
    property_id: 'p1',
    room_id: null,
    network_id: null,
    manufacturer: null,
    model: null,
    hub_type: 'bridge',
    local_control: true,
    cloud_dependency: false,
    internet_dependency: false,
    criticality: 'normal',
    status: 'online',
    firmware_version: null,
    recovery_steps: null,
    reset_instructions: null,
    credential_reference: null,
    notes: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    deleted_at: null,
    ...partial
  };
}

function network(partial: Partial<AutomationNetworkRow> & { id: string; name: string }): AutomationNetworkRow {
  return {
    property_id: 'p1',
    network_type: 'wifi',
    ssid: null,
    internet_provider: null,
    is_guest: false,
    is_iot: false,
    physical_location: null,
    recovery_instructions: null,
    credential_reference: null,
    notes: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    deleted_at: null,
    ...partial
  };
}

function routine(partial: Partial<AutomationRoutineRow> & { id: string; name: string }): AutomationRoutineRow {
  return {
    property_id: 'p1',
    routine_type: 'routine',
    description: null,
    platform: null,
    status: 'active',
    criticality: 'normal',
    trigger_text: null,
    conditions_text: null,
    actions_text: null,
    internet_dependency: false,
    local_control_available: true,
    failure_behavior: null,
    manual_override: null,
    last_tested: null,
    notes: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    deleted_at: null,
    ...partial
  };
}

const emptyGraph = (): FailureGraph => ({
  devices: [],
  hubs: [],
  networks: [],
  routines: [],
  routineDevices: [],
  deviceHubs: [],
  deviceNetworks: [],
  relationships: []
});

describe('failure impact — hub failure', () => {
  it('lists devices and automations that depend on a failed hub', () => {
    const graph = emptyGraph();
    graph.hubs = [hub({ id: 'hue', name: 'Hue Bridge', recovery_steps: 'Power-cycle the bridge' })];
    graph.devices = [
      device({ id: 'bulb1', name: 'Kitchen light', category: 'lighting', primary_hub_id: 'hue' }),
      device({ id: 'bulb2', name: 'Hall light', category: 'lighting', primary_hub_id: 'hue' }),
      device({ id: 'lock', name: 'Front lock', category: 'lock', primary_hub_id: null, local_control_available: true })
    ];
    graph.routines = [routine({ id: 'r1', name: 'Evening lights', criticality: 'normal' })];
    graph.routineDevices = [{ routine_id: 'r1', device_id: 'bulb1' }];

    const result = computeFailureImpact(graph, { type: 'hub', id: 'hue', label: 'Hue Bridge' });

    expect(result.affectedDevices.map((d) => d.id).sort()).toEqual(['bulb1', 'bulb2']);
    expect(result.affectedAutomations.map((r) => r.id)).toEqual(['r1']);
    // The lock is unaffected and works locally → manual alternative.
    expect(result.stillWorks.map((d) => d.id)).toContain('lock');
    expect(result.recoverySteps.join(' ')).toContain('Power-cycle the bridge');
  });
});

describe('failure impact — internet outage', () => {
  it('separates cloud-dependent devices from local ones', () => {
    const graph = emptyGraph();
    graph.devices = [
      device({ id: 'cam', name: 'Cloud camera', category: 'camera', internet_required: true, local_control_available: false }),
      device({ id: 'lock', name: 'Zigbee lock', category: 'lock', internet_required: false, local_control_available: true })
    ];
    graph.routines = [routine({ id: 'r1', name: 'Cloud notify', internet_dependency: true, criticality: 'high' })];

    const result = computeFailureImpact(graph, { type: 'internet', label: 'Internet' });

    expect(result.affectedDevices.map((d) => d.id)).toEqual(['cam']);
    expect(result.affectedAutomations.map((r) => r.id)).toEqual(['r1']);
    expect(result.stillWorks.map((d) => d.id)).toContain('lock');
    // camera is a security device → security warning present
    expect(result.warnings.some((w) => w.toLowerCase().includes('security'))).toBe(true);
  });
});

describe('failure impact — network cascade through hubs', () => {
  it('takes down hubs on the network and their devices', () => {
    const graph = emptyGraph();
    graph.networks = [network({ id: 'iot', name: 'IoT Wi-Fi' })];
    graph.hubs = [hub({ id: 'aqara', name: 'Aqara Hub', network_id: 'iot' })];
    graph.devices = [
      device({ id: 'sensor', name: 'Leak sensor', category: 'leak_detector', primary_hub_id: 'aqara' }),
      device({ id: 'other', name: 'Wired doorbell', category: 'doorbell', primary_network_id: null })
    ];

    const result = computeFailureImpact(graph, { type: 'network', id: 'iot', label: 'IoT Wi-Fi' });

    expect(result.affectedDevices.map((d) => d.id)).toEqual(['sensor']);
    expect(result.safetyAffected.map((d) => d.id)).toEqual(['sensor']);
    expect(result.warnings.some((w) => w.includes('safety'))).toBe(true);
  });
});

describe('failure impact — power circuit', () => {
  it('affects devices on a matching circuit reference', () => {
    const graph = emptyGraph();
    graph.devices = [
      device({ id: 'a', name: 'Garage opener', circuit_reference: 'Panel A / 14' }),
      device({ id: 'b', name: 'Office plug', circuit_reference: 'Panel A / 2' })
    ];
    const result = computeFailureImpact(graph, { type: 'power_circuit', label: 'Panel A / 14' });
    expect(result.affectedDevices.map((d) => d.id)).toEqual(['a']);
  });

  it('reports nothing-depends-on-this cleanly', () => {
    const result = computeFailureImpact(emptyGraph(), { type: 'internet', label: 'Internet' });
    expect(result.affectedDevices).toHaveLength(0);
    expect(result.warnings.some((w) => w.toLowerCase().includes('no recorded'))).toBe(true);
  });
});

describe('overview + completeness', () => {
  it('counts statuses, criticals, and local vs cloud', () => {
    const overview = computeAutomationOverview({
      devices: [
        device({ id: '1', name: 'a', status: 'online', is_critical: true, internet_required: true, local_control_available: false }),
        device({ id: '2', name: 'b', status: 'low_battery', internet_required: false, local_control_available: true }),
        device({ id: '3', name: 'c', status: 'retired' })
      ],
      hubs: [hub({ id: 'h', name: 'h' })],
      networks: [],
      routines: [routine({ id: 'r', name: 'r', criticality: 'critical', status: 'untested', last_tested: null })]
    });
    expect(overview.totalDevices).toBe(2); // retired excluded
    expect(overview.lowBattery).toBe(1);
    expect(overview.criticalDevices).toBe(1);
    expect(overview.cloudDependent).toBe(1);
    expect(overview.localOnly).toBe(1);
    expect(overview.hubs).toBe(1);
    expect(overview.untestedCriticalRoutines).toBe(1);
  });

  it('scores setup completeness higher when key fields are present', () => {
    const bare = device({ id: '1', name: 'bare' });
    const full = device({
      id: '2',
      name: 'full',
      room_id: 'r',
      primary_protocol: 'zigbee',
      manufacturer: 'Yale',
      model: 'X',
      setup_instructions: 'pair it',
      reset_instructions: 'hold button',
      primary_hub_id: 'h',
      serial_number: 'SN'
    });
    expect(deviceSetupCompleteness(full)).toBeGreaterThan(deviceSetupCompleteness(bare));
    expect(deviceSetupCompleteness(full)).toBe(100);
  });
});
