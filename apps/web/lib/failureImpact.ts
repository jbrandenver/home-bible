// Failure impact analysis — "what stops working if this fails?"
// Pure and fully testable: given the recorded dependency graph and a failure
// target, it reports ONLY conclusions supported by recorded data (per spec:
// "Do not infer unsupported relationships").

import type {
  AutomationDeviceRow,
  AutomationHubRow,
  AutomationNetworkRow,
  AutomationRelationshipRow,
  AutomationRoutineRow
} from './automation';

export type FailureTargetType = 'hub' | 'network' | 'internet' | 'cloud_service' | 'device' | 'power_circuit';

export type FailureTarget = {
  type: FailureTargetType;
  id?: string | null;
  label: string;
};

export type FailureGraph = {
  devices: AutomationDeviceRow[];
  hubs: AutomationHubRow[];
  networks: AutomationNetworkRow[];
  routines: AutomationRoutineRow[];
  routineDevices: Array<{ routine_id: string; device_id: string }>;
  deviceHubs: Array<{ device_id: string; hub_id: string; is_required: boolean }>;
  deviceNetworks: Array<{ device_id: string; network_id: string }>;
  relationships: AutomationRelationshipRow[];
};

export type FailureImpactResult = {
  target: FailureTarget;
  affectedDevices: AutomationDeviceRow[];
  affectedAutomations: AutomationRoutineRow[];
  safetyAffected: AutomationDeviceRow[];
  securityAffected: AutomationDeviceRow[];
  stillWorks: AutomationDeviceRow[];
  recoverySteps: string[];
  warnings: string[];
};

const SAFETY_CATEGORIES = new Set([
  'smoke_detector', 'carbon_monoxide_detector', 'leak_detector', 'water_shutoff_valve'
]);
const SECURITY_CATEGORIES = new Set([
  'camera', 'doorbell', 'lock', 'security_system', 'garage_door'
]);

function activeDevices(graph: FailureGraph): AutomationDeviceRow[] {
  return graph.devices.filter((d) => !d.deleted_at && d.status !== 'retired');
}

// Devices that depend on a given hub (primary FK or a required secondary link).
function devicesOnHub(graph: FailureGraph, hubId: string): Set<string> {
  const ids = new Set<string>();
  for (const d of activeDevices(graph)) {
    if (d.primary_hub_id === hubId) ids.add(d.id);
  }
  for (const link of graph.deviceHubs) {
    if (link.hub_id === hubId && link.is_required) ids.add(link.device_id);
  }
  return ids;
}

function devicesOnNetwork(graph: FailureGraph, networkId: string): Set<string> {
  const ids = new Set<string>();
  for (const d of activeDevices(graph)) {
    if (d.primary_network_id === networkId) ids.add(d.id);
  }
  for (const link of graph.deviceNetworks) {
    if (link.network_id === networkId) ids.add(link.device_id);
  }
  return ids;
}

// Resolve the affected device-id set for a target, following one level of
// hub cascade (a failed network takes down hubs on it, which take down their
// devices). Only recorded links are followed.
function computeAffectedDeviceIds(graph: FailureGraph, target: FailureTarget): Set<string> {
  const affected = new Set<string>();
  const active = activeDevices(graph);

  const addHubDevices = (hubId: string) => {
    for (const id of devicesOnHub(graph, hubId)) affected.add(id);
  };

  switch (target.type) {
    case 'hub':
      if (target.id) addHubDevices(target.id);
      break;

    case 'network':
      if (target.id) {
        for (const id of devicesOnNetwork(graph, target.id)) affected.add(id);
        // hubs on this network fail too → cascade their devices
        for (const hub of graph.hubs) {
          if (hub.network_id === target.id) addHubDevices(hub.id);
        }
      }
      break;

    case 'internet':
      for (const d of active) {
        if (d.internet_required) affected.add(d.id);
      }
      for (const hub of graph.hubs) {
        if (hub.internet_dependency) addHubDevices(hub.id);
      }
      for (const rel of graph.relationships) {
        if (rel.deleted_at) continue;
        if ((rel.target_type === 'internet' || rel.target_type === 'cloud_service') && rel.source_type === 'device' && rel.source_id) {
          affected.add(rel.source_id);
        }
      }
      break;

    case 'cloud_service':
      for (const rel of graph.relationships) {
        if (rel.deleted_at) continue;
        const matches =
          rel.target_type === 'cloud_service' &&
          ((target.id && rel.target_id === target.id) || (!target.id && rel.target_label === target.label));
        if (matches && rel.source_type === 'device' && rel.source_id) affected.add(rel.source_id);
        if (matches && rel.source_type === 'hub' && rel.source_id) addHubDevices(rel.source_id);
      }
      break;

    case 'device':
      if (target.id) {
        // child devices depend on the parent
        for (const d of active) {
          if (d.parent_device_id === target.id) affected.add(d.id);
        }
        for (const rel of graph.relationships) {
          if (rel.deleted_at) continue;
          if (rel.target_type === 'device' && rel.target_id === target.id && rel.source_type === 'device' && rel.source_id) {
            affected.add(rel.source_id);
          }
        }
      }
      break;

    case 'power_circuit':
      for (const d of active) {
        if (d.circuit_reference && d.circuit_reference === target.label) affected.add(d.id);
      }
      break;
  }

  return affected;
}

export function computeFailureImpact(graph: FailureGraph, target: FailureTarget): FailureImpactResult {
  const active = activeDevices(graph);
  const affectedIds = computeAffectedDeviceIds(graph, target);
  const affectedDevices = active.filter((d) => affectedIds.has(d.id));

  // Automations that involve any affected device, plus internet-dependent
  // automations when the internet itself fails.
  const affectedRoutineIds = new Set<string>();
  for (const link of graph.routineDevices) {
    if (affectedIds.has(link.device_id)) affectedRoutineIds.add(link.routine_id);
  }
  if (target.type === 'internet') {
    for (const routine of graph.routines) {
      if (!routine.deleted_at && routine.internet_dependency) affectedRoutineIds.add(routine.id);
    }
  }
  const affectedAutomations = graph.routines.filter((r) => !r.deleted_at && affectedRoutineIds.has(r.id));

  const safetyAffected = affectedDevices.filter((d) => SAFETY_CATEGORIES.has(d.category));
  const securityAffected = affectedDevices.filter((d) => SECURITY_CATEGORIES.has(d.category));

  // Manual alternatives: active devices that still work locally and are not affected.
  const stillWorks = active.filter((d) => !affectedIds.has(d.id) && d.local_control_available && !d.internet_required);

  // Recovery steps — only from recorded instructions.
  const recoverySteps: string[] = [];
  if (target.type === 'hub' && target.id) {
    const hub = graph.hubs.find((h) => h.id === target.id);
    if (hub?.recovery_steps) recoverySteps.push(`${hub.name}: ${hub.recovery_steps}`);
    else if (hub?.reset_instructions) recoverySteps.push(`${hub.name}: ${hub.reset_instructions}`);
  }
  if (target.type === 'network' && target.id) {
    const network = graph.networks.find((n) => n.id === target.id);
    if (network?.recovery_instructions) recoverySteps.push(`${network.name}: ${network.recovery_instructions}`);
  }
  for (const d of affectedDevices) {
    if (d.is_critical && d.reset_instructions) recoverySteps.push(`${d.nickname || d.name}: ${d.reset_instructions}`);
  }

  // Warnings — prioritize safety and security.
  const warnings: string[] = [];
  if (safetyAffected.length > 0) {
    warnings.push(
      `⚠ ${safetyAffected.length} safety device${safetyAffected.length === 1 ? '' : 's'} affected (${safetyAffected
        .map((d) => d.nickname || d.name)
        .join(', ')}). Confirm smoke/CO/leak protection another way until restored.`
    );
  }
  if (securityAffected.length > 0) {
    warnings.push(
      `⚠ ${securityAffected.length} security device${securityAffected.length === 1 ? '' : 's'} affected (${securityAffected
        .map((d) => d.nickname || d.name)
        .join(', ')}). Locks/cameras may not respond remotely — verify manual entry.`
    );
  }
  const criticalAutomations = affectedAutomations.filter((r) => r.criticality === 'critical' || r.criticality === 'high');
  if (criticalAutomations.length > 0) {
    warnings.push(
      `${criticalAutomations.length} important automation${criticalAutomations.length === 1 ? '' : 's'} will not run (${criticalAutomations
        .map((r) => r.name)
        .join(', ')}).`
    );
  }
  if (affectedDevices.length === 0 && affectedAutomations.length === 0) {
    warnings.push('No recorded devices or automations depend on this. If something still breaks, its dependency may not be documented yet.');
  }

  return {
    target,
    affectedDevices,
    affectedAutomations,
    safetyAffected,
    securityAffected,
    stillWorks,
    recoverySteps,
    warnings
  };
}
