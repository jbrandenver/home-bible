import { describe, expect, it } from 'vitest';
import {
  createAutomationDeviceSchema,
  createAutomationHubSchema,
  createAutomationNetworkSchema,
  createAutomationRoutineSchema,
  quickAddAutomationDeviceSchema
} from '@home-folder/shared';

describe('automation validation schemas', () => {
  it('rejects a device with no name', () => {
    const result = createAutomationDeviceSchema.safeParse({ name: '   ' });
    expect(result.success).toBe(false);
  });

  it('applies defaults and accepts a minimal valid device', () => {
    const result = createAutomationDeviceSchema.safeParse({ name: 'Front lock' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('other');
      expect(result.data.status).toBe('unknown');
      expect(result.data.is_critical).toBe(false);
      expect(result.data.local_control_available).toBe(true);
    }
  });

  it('rejects an unknown category / protocol (enum guard)', () => {
    expect(createAutomationDeviceSchema.safeParse({ name: 'x', category: 'teleporter' }).success).toBe(false);
    expect(createAutomationDeviceSchema.safeParse({ name: 'x', primary_protocol: 'smoke-signals' }).success).toBe(false);
  });

  it('accepts multiple ecosystems and protocols', () => {
    const result = createAutomationDeviceSchema.safeParse({
      name: 'Hub bulb',
      ecosystems: ['apple_home', 'google_home'],
      protocols: ['zigbee', 'matter']
    });
    expect(result.success).toBe(true);
  });

  it('quick-add requires only a name', () => {
    expect(quickAddAutomationDeviceSchema.safeParse({ name: 'Sensor' }).success).toBe(true);
    expect(quickAddAutomationDeviceSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('validates hub, network, and routine minimally', () => {
    expect(createAutomationHubSchema.safeParse({ name: 'Hue Bridge' }).success).toBe(true);
    expect(createAutomationHubSchema.safeParse({ name: 'x', hub_type: 'nonsense' }).success).toBe(false);
    expect(createAutomationNetworkSchema.safeParse({ name: 'Wi-Fi' }).success).toBe(true);
    expect(createAutomationRoutineSchema.safeParse({ name: 'Lock up', routine_type: 'security' }).success).toBe(true);
    expect(createAutomationRoutineSchema.safeParse({ name: 'x', status: 'exploded' }).success).toBe(false);
  });

  it('rejects negative purchase price', () => {
    expect(createAutomationDeviceSchema.safeParse({ name: 'x', purchase_price: -5 }).success).toBe(false);
  });
});
