// Automation exports — CSV (devices/hubs/networks/automations) and full JSON.
// Sensitive fields are NEVER exported. Credential *reference* names are excluded
// by default and only included when the owner explicitly opts in.

import { safeText } from '@home-folder/shared';
import type {
  AutomationDeviceRow,
  AutomationHubRow,
  AutomationNetworkRow,
  AutomationRoutineRow
} from './automation';

export type ExportOptions = { includeCredentialReferences: boolean };

// Leading =, +, -, @, tab or CR is a formula to Excel and Sheets, not text.
// Device and routine names are user-supplied, so neutralise before quoting.
function csvEscape(value: string | number | boolean | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  const neutralized = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(neutralized) ? `"${neutralized.replace(/"/g, '""')}"` : neutralized;
}

function credentialField(value: string | null, options: ExportOptions): string {
  return options.includeCredentialReferences ? value ?? '' : '';
}

export function devicesToCsv(devices: AutomationDeviceRow[], options: ExportOptions): string {
  const header = [
    'Name', 'Nickname', 'Category', 'Manufacturer', 'Model', 'Serial', 'Status',
    'Critical', 'Protocol', 'Power', 'Needs internet', 'Works locally',
    'Firmware', 'Warranty ends', 'Credential reference'
  ];
  const lines = [header.join(',')];
  for (const d of devices) {
    lines.push(
      [
        csvEscape(safeText(d.name) ?? d.name),
        csvEscape(d.nickname),
        csvEscape(d.category),
        csvEscape(d.manufacturer),
        csvEscape(d.model),
        csvEscape(d.serial_number),
        csvEscape(d.status),
        csvEscape(d.is_critical),
        csvEscape(d.primary_protocol),
        csvEscape(d.power_type),
        csvEscape(d.internet_required),
        csvEscape(d.local_control_available && !d.internet_required),
        csvEscape(d.firmware_version),
        csvEscape(d.warranty_expiration),
        csvEscape(credentialField(d.credential_reference, options))
      ].join(',')
    );
  }
  return lines.join('\n');
}

export function hubsToCsv(hubs: AutomationHubRow[], options: ExportOptions): string {
  const header = ['Name', 'Type', 'Manufacturer', 'Model', 'Local control', 'Needs internet', 'Criticality', 'Status', 'Credential reference'];
  const lines = [header.join(',')];
  for (const h of hubs) {
    lines.push(
      [
        csvEscape(h.name),
        csvEscape(h.hub_type),
        csvEscape(h.manufacturer),
        csvEscape(h.model),
        csvEscape(h.local_control),
        csvEscape(h.internet_dependency),
        csvEscape(h.criticality),
        csvEscape(h.status),
        csvEscape(credentialField(h.credential_reference, options))
      ].join(',')
    );
  }
  return lines.join('\n');
}

export function networksToCsv(networks: AutomationNetworkRow[], options: ExportOptions): string {
  const header = ['Name', 'Type', 'SSID', 'Provider', 'Guest', 'IoT', 'Location', 'Credential reference'];
  const lines = [header.join(',')];
  for (const n of networks) {
    lines.push(
      [
        csvEscape(n.name),
        csvEscape(n.network_type),
        csvEscape(n.ssid),
        csvEscape(n.internet_provider),
        csvEscape(n.is_guest),
        csvEscape(n.is_iot),
        csvEscape(n.physical_location),
        csvEscape(credentialField(n.credential_reference, options))
      ].join(',')
    );
  }
  return lines.join('\n');
}

export function routinesToCsv(routines: AutomationRoutineRow[]): string {
  const header = ['Name', 'Type', 'Status', 'Criticality', 'Trigger', 'Actions', 'Needs internet', 'Manual override'];
  const lines = [header.join(',')];
  for (const r of routines) {
    lines.push(
      [
        csvEscape(r.name),
        csvEscape(r.routine_type),
        csvEscape(r.status),
        csvEscape(r.criticality),
        csvEscape(safeText(r.trigger_text)),
        csvEscape(safeText(r.actions_text)),
        csvEscape(r.internet_dependency),
        csvEscape(safeText(r.manual_override))
      ].join(',')
    );
  }
  return lines.join('\n');
}

export function buildJsonExport(
  data: {
    propertyName: string;
    devices: AutomationDeviceRow[];
    hubs: AutomationHubRow[];
    networks: AutomationNetworkRow[];
    routines: AutomationRoutineRow[];
  },
  options: ExportOptions,
  generatedAt: string
): string {
  // Scrub every free-text field the same way the print/emergency path does,
  // so a secret typed into ANY notes-style field never leaks in the JSON either.
  const cred = (value: string | null) => (options.includeCredentialReferences ? value : null);

  const scrubDevice = (d: AutomationDeviceRow) => ({
    ...d,
    credential_reference: cred(d.credential_reference),
    setup_instructions: safeText(d.setup_instructions),
    reset_instructions: safeText(d.reset_instructions),
    handover_notes: safeText(d.handover_notes),
    troubleshooting_notes: safeText(d.troubleshooting_notes),
    notes: safeText(d.notes)
  });

  const scrubHub = (h: AutomationHubRow) => ({
    ...h,
    credential_reference: cred(h.credential_reference),
    recovery_steps: safeText(h.recovery_steps),
    reset_instructions: safeText(h.reset_instructions),
    notes: safeText(h.notes)
  });

  const scrubNetwork = (n: AutomationNetworkRow) => ({
    ...n,
    credential_reference: cred(n.credential_reference),
    recovery_instructions: safeText(n.recovery_instructions),
    notes: safeText(n.notes)
  });

  const scrubRoutine = (r: AutomationRoutineRow) => ({
    ...r,
    description: safeText(r.description),
    trigger_text: safeText(r.trigger_text),
    conditions_text: safeText(r.conditions_text),
    actions_text: safeText(r.actions_text),
    failure_behavior: safeText(r.failure_behavior),
    manual_override: safeText(r.manual_override),
    notes: safeText(r.notes)
  });

  return JSON.stringify(
    {
      export: 'home-folder-automation',
      generatedAt,
      property: data.propertyName,
      includesCredentialReferences: options.includeCredentialReferences,
      devices: data.devices.map(scrubDevice),
      hubs: data.hubs.map(scrubHub),
      networks: data.networks.map(scrubNetwork),
      automations: data.routines.map(scrubRoutine)
    },
    null,
    2
  );
}

export function downloadTextFile(filename: string, contents: string, mime = 'text/plain') {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
