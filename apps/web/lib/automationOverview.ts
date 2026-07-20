// Pure overview/health computation over automation rows — no I/O, fully testable.
import type {
  AutomationDeviceRow,
  AutomationHubRow,
  AutomationNetworkRow,
  AutomationRoutineRow
} from './automation';

export type AutomationOverview = {
  totalDevices: number;
  online: number;
  offline: number;
  needsAttention: number;
  unknown: number;
  retired: number;
  lowBattery: number;
  criticalDevices: number;
  cloudDependent: number;
  localOnly: number;
  noRoom: number;
  incompleteSetup: number;
  noResetInstructions: number;
  hubs: number;
  networks: number;
  routines: number;
  brokenRoutines: number;
  untestedCriticalRoutines: number;
  byCategory: Array<{ key: string; count: number }>;
  byProtocol: Array<{ key: string; count: number }>;
};

// A device is "incomplete" if it lacks the records that matter for handover.
export function isDeviceSetupIncomplete(device: AutomationDeviceRow): boolean {
  return (
    !device.room_id ||
    !device.primary_protocol ||
    !device.manufacturer ||
    !device.setup_instructions
  );
}

export function deviceSetupCompleteness(device: AutomationDeviceRow): number {
  const checks = [
    Boolean(device.room_id),
    Boolean(device.primary_protocol),
    Boolean(device.manufacturer),
    Boolean(device.model),
    Boolean(device.setup_instructions),
    Boolean(device.reset_instructions),
    device.primary_hub_id !== null || device.primary_network_id !== null,
    Boolean(device.serial_number)
  ];
  const earned = checks.filter(Boolean).length;
  return Math.round((earned / checks.length) * 100);
}

function tally(values: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export function computeAutomationOverview(params: {
  devices: AutomationDeviceRow[];
  hubs: AutomationHubRow[];
  networks: AutomationNetworkRow[];
  routines: AutomationRoutineRow[];
}): AutomationOverview {
  const { devices, hubs, networks, routines } = params;
  const active = devices.filter((d) => d.status !== 'retired');

  return {
    totalDevices: active.length,
    online: devices.filter((d) => d.status === 'online').length,
    offline: devices.filter((d) => d.status === 'offline').length,
    needsAttention: devices.filter((d) => d.status === 'needs_attention' || d.status === 'intermittent').length,
    unknown: devices.filter((d) => d.status === 'unknown').length,
    retired: devices.filter((d) => d.status === 'retired').length,
    lowBattery: devices.filter((d) => d.status === 'low_battery').length,
    criticalDevices: active.filter((d) => d.is_critical).length,
    cloudDependent: active.filter((d) => d.internet_required).length,
    localOnly: active.filter((d) => d.local_control_available && !d.internet_required).length,
    noRoom: active.filter((d) => !d.room_id).length,
    incompleteSetup: active.filter(isDeviceSetupIncomplete).length,
    noResetInstructions: active.filter((d) => d.is_critical && !d.reset_instructions).length,
    hubs: hubs.length,
    networks: networks.length,
    routines: routines.length,
    brokenRoutines: routines.filter((r) => r.status === 'broken').length,
    untestedCriticalRoutines: routines.filter(
      (r) => (r.criticality === 'critical' || r.criticality === 'high') && (r.status === 'untested' || !r.last_tested)
    ).length,
    byCategory: tally(active.map((d) => d.category)),
    byProtocol: tally(
      active.map((d) => d.primary_protocol).filter((p): p is NonNullable<typeof p> => p !== null)
    )
  };
}
