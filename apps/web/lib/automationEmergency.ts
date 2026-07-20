// Emergency & Handover guide — pure assembly from recorded automation data.
// Intended for family, house sitters, responders, technicians, or a new owner.
// Sensitive free-text is scrubbed with the shared safeText(); credential
// *reference* names are excluded unless explicitly opted in.

import { safeText } from '@home-folder/shared';
import type {
  AutomationDeviceRow,
  AutomationHubRow,
  AutomationNetworkRow,
  AutomationRoutineRow
} from './automation';

export type EmergencyDevice = {
  id: string;
  name: string;
  category: string;
  location: string | null;
  worksLocally: boolean;
  reset: string | null;
  handover: string | null;
};

export type EmergencyGuide = {
  propertyName: string;
  generatedAtLabel: string | null;
  criticalSafety: EmergencyDevice[];
  locks: EmergencyDevice[];
  security: EmergencyDevice[];
  garage: EmergencyDevice[];
  hubRestartOrder: Array<{ name: string; type: string; recovery: string | null }>;
  networkRestart: Array<{ name: string; recovery: string | null }>;
  needsInternet: string[];
  worksLocally: string[];
  criticalAutomations: Array<{ name: string; manualOverride: string | null; failureBehavior: string | null }>;
  playbooks: Array<{ title: string; steps: string[] }>;
};

const SAFETY = new Set(['smoke_detector', 'carbon_monoxide_detector', 'leak_detector', 'water_shutoff_valve']);
const SECURITY = new Set(['camera', 'doorbell', 'security_system']);

function toEmergencyDevice(d: AutomationDeviceRow, roomLabel: (roomId: string | null) => string | null): EmergencyDevice {
  return {
    id: d.id,
    name: d.nickname || d.name,
    category: d.category,
    location: roomLabel(d.room_id),
    worksLocally: d.local_control_available && !d.internet_required,
    reset: safeText(d.reset_instructions),
    handover: safeText(d.handover_notes)
  };
}

export function buildEmergencyGuide(params: {
  propertyName: string;
  devices: AutomationDeviceRow[];
  hubs: AutomationHubRow[];
  networks: AutomationNetworkRow[];
  routines: AutomationRoutineRow[];
  roomLabel: (roomId: string | null) => string | null;
  generatedAtLabel?: string | null;
}): EmergencyGuide {
  const { propertyName, hubs, networks, routines, roomLabel } = params;
  const active = params.devices.filter((d) => !d.deleted_at && d.status !== 'retired');
  const toDev = (d: AutomationDeviceRow) => toEmergencyDevice(d, roomLabel);

  const criticalSafety = active.filter((d) => SAFETY.has(d.category)).map(toDev);
  const locks = active.filter((d) => d.category === 'lock').map(toDev);
  const security = active.filter((d) => SECURITY.has(d.category)).map(toDev);
  const garage = active.filter((d) => d.category === 'garage_door').map(toDev);

  const hubRestartOrder = [...hubs]
    .filter((h) => !h.deleted_at)
    .sort((a, b) => criticalityRank(b.criticality) - criticalityRank(a.criticality))
    .map((h) => ({ name: h.name, type: h.hub_type, recovery: safeText(h.recovery_steps) || safeText(h.reset_instructions) }));

  const networkRestart = networks
    .filter((n) => !n.deleted_at)
    .map((n) => ({ name: n.name, recovery: safeText(n.recovery_instructions) }));

  const needsInternet = active.filter((d) => d.internet_required).map((d) => d.nickname || d.name);
  const worksLocally = active.filter((d) => d.local_control_available && !d.internet_required).map((d) => d.nickname || d.name);

  const criticalAutomations = routines
    .filter((r) => !r.deleted_at && (r.criticality === 'critical' || r.criticality === 'high'))
    .map((r) => ({ name: r.name, manualOverride: safeText(r.manual_override), failureBehavior: safeText(r.failure_behavior) }));

  const playbooks = buildPlaybooks({ needsInternetCount: needsInternet.length, locks, criticalSafety });

  return {
    propertyName: propertyName || 'Home',
    generatedAtLabel: params.generatedAtLabel ?? null,
    criticalSafety,
    locks,
    security,
    garage,
    hubRestartOrder,
    networkRestart,
    needsInternet,
    worksLocally,
    criticalAutomations,
    playbooks
  };
}

function criticalityRank(value: string): number {
  return value === 'critical' ? 3 : value === 'high' ? 2 : value === 'normal' ? 1 : 0;
}

function buildPlaybooks(ctx: { needsInternetCount: number; locks: EmergencyDevice[]; criticalSafety: EmergencyDevice[] }) {
  return [
    {
      title: 'During a power outage',
      steps: [
        'Battery and hardwired safety devices keep working; mains-powered smart devices go dark until power returns.',
        'Smart locks usually have a physical key or keypad — see the locks section below.',
        'When power returns, hubs and the router may need a few minutes to reconnect. Restart in the order listed below if devices stay offline.'
      ]
    },
    {
      title: 'During an internet outage',
      steps: [
        `${ctx.needsInternetCount} device${ctx.needsInternetCount === 1 ? '' : 's'} need internet and will stop responding (listed below).`,
        'Devices marked "works locally" keep working on the home network.',
        'Restart the modem/router first (network section), then hubs if needed.'
      ]
    },
    {
      title: 'When a hub fails',
      steps: [
        'Devices that connect through that hub stop responding — use the "What fails if…" screen to see exactly which.',
        'Follow the hub\'s recovery steps below. If it must be replaced, the device records hold pairing info.'
      ]
    },
    {
      title: 'When a smart lock fails',
      steps: [
        'Use the physical key or backup keypad code (stored in your password manager — not printed here).',
        'Replace the batteries; most locks warn before they die. Reset steps are on each lock below.'
      ]
    },
    {
      title: 'When a leak is detected',
      steps: [
        'Locate the main water shut-off (Utilities → Main water shut-off) and close it.',
        ctx.criticalSafety.some((d) => d.category === 'water_shutoff_valve')
          ? 'An automatic water shut-off is installed — confirm it triggered; close the manual valve as backup.'
          : 'Close the manual valve; there is no automatic shut-off recorded.'
      ]
    }
  ];
}
