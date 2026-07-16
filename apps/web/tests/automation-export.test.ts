import { describe, expect, it } from 'vitest';
import { buildJsonExport, devicesToCsv } from '../lib/automationExport';
import { buildEmergencyGuide } from '../lib/automationEmergency';
import type { AutomationDeviceRow } from '../lib/automation';

function device(partial: Partial<AutomationDeviceRow> & { id: string; name: string }): AutomationDeviceRow {
  return {
    property_id: 'p1', floor_id: null, room_id: null, primary_hub_id: null, primary_network_id: null,
    parent_device_id: null, nickname: null, category: 'other', manufacturer: null, model: null,
    serial_number: null, status: 'online', is_critical: false, indoor_outdoor: 'indoor',
    primary_protocol: null, power_type: 'mains', battery_type: null, last_battery_replacement: null,
    circuit_reference: null, internet_required: false, local_control_available: true, firmware_version: null,
    warranty_expiration: null, purchase_price: null, setup_instructions: null, reset_instructions: null,
    troubleshooting_notes: null, handover_notes: null, credential_reference: null, notes: null,
    last_checked_date: null, retired_date: null, created_at: '2026-01-01', updated_at: '2026-01-01',
    deleted_at: null, ...partial
  };
}

describe('export redaction', () => {
  const devices = [device({ id: '1', name: 'Front lock', category: 'lock', credential_reference: '1Password › Front door' })];

  it('excludes credential references from CSV by default', () => {
    const csv = devicesToCsv(devices, { includeCredentialReferences: false });
    expect(csv).not.toContain('1Password');
  });

  it('includes credential references only when opted in', () => {
    const csv = devicesToCsv(devices, { includeCredentialReferences: true });
    expect(csv).toContain('1Password › Front door');
  });

  it('scrubs sensitive free-text and drops credential refs from JSON by default', () => {
    const withSecret = [device({ id: '2', name: 'Lock', category: 'lock', reset_instructions: 'garage code is 4821', notes: 'wifi password is hunter2', credential_reference: 'Bitwarden entry' })];
    const json = buildJsonExport({ propertyName: 'Home', devices: withSecret, hubs: [], networks: [], routines: [] }, { includeCredentialReferences: false }, '2026-07-16T00:00:00Z');
    expect(json).not.toContain('Bitwarden entry');
    expect(json).not.toContain('4821');
    expect(json).not.toContain('hunter2'); // device.notes must be scrubbed too
    expect(json).toContain('Hidden by privacy rule');
  });

  it('scrubs secrets inside routine/hub/network fields in JSON (H1 regression)', () => {
    const json = buildJsonExport(
      {
        propertyName: 'Home',
        devices: [],
        hubs: [],
        networks: [],
        routines: [
          {
            id: 'r', property_id: 'p1', name: 'Disarm', routine_type: 'security', description: null, platform: null,
            status: 'active', criticality: 'high', trigger_text: null, conditions_text: null,
            actions_text: 'enter alarm code 4-7-2-9', internet_dependency: false, local_control_available: true,
            failure_behavior: null, manual_override: null, last_tested: null, notes: null,
            created_at: '2026-01-01', updated_at: '2026-01-01', deleted_at: null
          }
        ]
      },
      { includeCredentialReferences: false },
      '2026-07-16T00:00:00Z'
    );
    expect(json).not.toContain('4-7-2-9');
    expect(json).toContain('Hidden by privacy rule');
  });
});

describe('emergency guide', () => {
  it('separates local from internet-dependent and scrubs secrets', () => {
    const guide = buildEmergencyGuide({
      propertyName: 'Maple St',
      devices: [
        device({ id: 'leak', name: 'Basement leak sensor', category: 'leak_detector', local_control_available: true, reset_instructions: 'wifi password is hunter2' }),
        device({ id: 'cam', name: 'Cloud cam', category: 'camera', internet_required: true, local_control_available: false })
      ],
      hubs: [],
      networks: [],
      routines: [],
      roomLabel: () => 'Basement'
    });
    expect(guide.criticalSafety.map((d) => d.id)).toContain('leak');
    expect(guide.needsInternet).toContain('Cloud cam');
    expect(guide.worksLocally).toContain('Basement leak sensor');
    // secret in reset text must be scrubbed
    expect(guide.criticalSafety.find((d) => d.id === 'leak')?.reset).toBe('Hidden by privacy rule');
    expect(guide.playbooks.length).toBeGreaterThan(0);
  });
});
