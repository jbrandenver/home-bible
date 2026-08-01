import { beforeEach, describe, expect, it } from 'vitest';
import {
  createIssueForContext,
  updateIssueForContext,
  type IssueDataContext
} from '../lib/issues';
import {
  createRepairForContext,
  updateRepairForContext,
  type RepairDataContext
} from '../lib/repairs';
import {
  createServiceRecordForContext,
  updateServiceRecordForContext,
  type ServiceRecordDataContext
} from '../lib/serviceRecords';

// Repairs, issues, and service records were write-once: only `status` could
// change after creation, so a record filed against the wrong room stayed wrong.
// These cover the demo-mode edit paths — every field, and every link, including
// clearing a link back to none.

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      }
    }
  };
});

const demoContext = {
  mode: 'demo',
  supabaseConfigured: false,
  user: null,
  property: null
} as const;

const repairContext: RepairDataContext = demoContext;
const issueContext: IssueDataContext = demoContext;
const serviceContext: ServiceRecordDataContext = demoContext;

describe('updateRepairForContext (demo)', () => {
  it('rewrites every user-meaningful field, not just status', async () => {
    const created = await createRepairForContext(repairContext, {
      title: 'Kitchen tap drips',
      repair_type: 'plumbing',
      priority: 'normal',
      reported_date: '2026-01-04',
      estimated_cost: 120
    });

    const updated = await updateRepairForContext(repairContext, created.id, {
      title: 'Kitchen tap replaced',
      description: 'Cartridge worn through.',
      repair_type: 'plumbing',
      status: 'completed',
      priority: 'high',
      reported_date: '2026-01-04',
      completed_date: '2026-01-11',
      scheduled_date: '2026-01-09',
      scheduled_window: '8am – 12pm',
      contractor_name: 'Ellis Plumbing',
      contractor_phone: '555-0142',
      contractor_email: 'book@ellis.example',
      estimated_cost: 120,
      actual_cost: 145.5,
      notes: 'Paid on the day.'
    });

    expect(updated).not.toBeNull();
    expect(updated?.title).toBe('Kitchen tap replaced');
    expect(updated?.priority).toBe('high');
    expect(updated?.status).toBe('completed');
    expect(updated?.completed_date).toBe('2026-01-11');
    expect(updated?.actual_cost).toBe(145.5);
    expect(updated?.notes).toBe('Paid on the day.');
  });

  it('reschedules a visit without deleting the repair', async () => {
    const created = await createRepairForContext(repairContext, {
      title: 'Boiler service',
      scheduled_date: '2026-02-02',
      scheduled_window: '8am – 12pm'
    });

    const updated = await updateRepairForContext(repairContext, created.id, {
      title: 'Boiler service',
      scheduled_date: '2026-02-09',
      scheduled_window: '1pm – 5pm'
    });

    expect(updated?.scheduled_date).toBe('2026-02-09');
    expect(updated?.scheduled_window).toBe('1pm – 5pm');
  });

  it('moves the room, asset, and utility links, and can clear them', async () => {
    const created = await createRepairForContext(repairContext, {
      title: 'Draught at the window',
      room_id: 'room-1',
      asset_id: 'asset-1',
      utility_id: 'utility-1'
    });

    const relinked = await updateRepairForContext(repairContext, created.id, {
      title: 'Draught at the window',
      room_id: 'room-2',
      asset_id: 'asset-2',
      utility_id: 'utility-2'
    });

    expect(relinked?.room_id).toBe('room-2');
    expect(relinked?.asset_id).toBe('asset-2');
    expect(relinked?.utility_id).toBe('utility-2');

    const cleared = await updateRepairForContext(repairContext, created.id, {
      title: 'Draught at the window',
      room_id: null,
      asset_id: null,
      utility_id: null
    });

    expect(cleared?.room_id).toBeNull();
    expect(cleared?.asset_id).toBeNull();
    expect(cleared?.utility_id).toBeNull();
  });

  it('leaves other repairs untouched', async () => {
    const first = await createRepairForContext(repairContext, { title: 'First' });
    const second = await createRepairForContext(repairContext, { title: 'Second' });

    await updateRepairForContext(repairContext, first.id, { title: 'First, corrected' });

    const stored = JSON.parse(store.get('homeFolder.repairs') ?? '[]') as Array<{
      id: string;
      title: string;
    }>;

    expect(stored.find((repair) => repair.id === second.id)?.title).toBe('Second');
    expect(stored.find((repair) => repair.id === first.id)?.title).toBe('First, corrected');
  });
});

describe('updateIssueForContext (demo)', () => {
  it('rewrites dates, notes, severity, and type', async () => {
    const created = await createIssueForContext(issueContext, {
      title: 'Damp patch on the ceiling',
      issue_type: 'general',
      severity: 'low',
      first_seen_date: '2026-03-01'
    });

    const updated = await updateIssueForContext(issueContext, created.id, {
      title: 'Damp patch under the bathroom',
      description: 'Spreading after showers.',
      issue_type: 'water_leak',
      status: 'monitoring',
      severity: 'high',
      first_seen_date: '2026-02-20',
      last_seen_date: '2026-03-14',
      resolved_date: null,
      notes: 'Watching for a week before calling anyone.'
    });

    expect(updated?.title).toBe('Damp patch under the bathroom');
    expect(updated?.issue_type).toBe('water_leak');
    expect(updated?.severity).toBe('high');
    expect(updated?.status).toBe('monitoring');
    expect(updated?.first_seen_date).toBe('2026-02-20');
    expect(updated?.last_seen_date).toBe('2026-03-14');
    expect(updated?.notes).toBe('Watching for a week before calling anyone.');
  });

  it('relinks the repair and can clear it back to none', async () => {
    const created = await createIssueForContext(issueContext, {
      title: 'Radiator cold at the top',
      repair_id: 'repair-1'
    });

    const relinked = await updateIssueForContext(issueContext, created.id, {
      title: 'Radiator cold at the top',
      repair_id: 'repair-2'
    });

    expect(relinked?.repair_id).toBe('repair-2');

    const cleared = await updateIssueForContext(issueContext, created.id, {
      title: 'Radiator cold at the top',
      repair_id: null
    });

    expect(cleared?.repair_id).toBeNull();
  });

  it('clears notes rather than falling back to the legacy column', async () => {
    const created = await createIssueForContext(issueContext, {
      title: 'Scuffed skirting',
      notes: 'Only cosmetic.'
    });

    expect(created.notes).toBe('Only cosmetic.');

    const updated = await updateIssueForContext(issueContext, created.id, {
      title: 'Scuffed skirting',
      notes: null
    });

    expect(updated?.notes).toBeNull();
  });
});

describe('updateServiceRecordForContext (demo)', () => {
  it('rewrites the provider, cost, dates, and summary', async () => {
    const created = await createServiceRecordForContext(serviceContext, {
      service_title: 'Annual boiler service',
      service_type: 'maintenance',
      service_date: '2026-04-02',
      provider_name: 'Old Provider',
      cost: 90
    });

    const updated = await updateServiceRecordForContext(serviceContext, created.id, {
      service_title: 'Annual boiler service and flue check',
      service_type: 'inspection',
      service_date: '2026-04-03',
      provider_name: 'Ellis Heating',
      provider_phone: '555-0188',
      provider_email: 'service@ellis.example',
      cost: 135,
      summary: 'Flue drawn and tested.',
      notes: 'Certificate filed under documents.',
      next_service_date: '2027-04-03'
    });

    expect(updated?.service_title).toBe('Annual boiler service and flue check');
    expect(updated?.service_type).toBe('inspection');
    expect(updated?.service_date).toBe('2026-04-03');
    expect(updated?.provider_name).toBe('Ellis Heating');
    expect(updated?.cost).toBe(135);
    expect(updated?.summary).toBe('Flue drawn and tested.');
    expect(updated?.next_service_date).toBe('2027-04-03');
  });

  it('keeps the legacy vendor and follow-up columns in step', async () => {
    const created = await createServiceRecordForContext(serviceContext, {
      service_title: 'Gutter clear',
      provider_name: 'First Firm'
    });

    const updated = await updateServiceRecordForContext(serviceContext, created.id, {
      service_title: 'Gutter clear',
      provider_name: 'Second Firm',
      provider_phone: '555-0100',
      summary: 'Both elevations.',
      next_service_date: '2027-01-05'
    });

    expect(updated?.vendor_name).toBe('Second Firm');
    expect(updated?.vendor_phone).toBe('555-0100');
    expect(updated?.title).toBe('Gutter clear');
    expect(updated?.description).toBe('Both elevations.');
    expect(updated?.follow_up_date).toBe('2027-01-05');
    expect(updated?.follow_up_needed).toBe(true);
  });

  it('moves the links and can clear them', async () => {
    const created = await createServiceRecordForContext(serviceContext, {
      service_title: 'Filter change',
      room_id: 'room-1',
      asset_id: 'asset-1',
      utility_id: 'utility-1'
    });

    const relinked = await updateServiceRecordForContext(serviceContext, created.id, {
      service_title: 'Filter change',
      room_id: 'room-9',
      asset_id: 'asset-9',
      utility_id: 'utility-9'
    });

    expect(relinked?.room_id).toBe('room-9');
    expect(relinked?.asset_id).toBe('asset-9');
    expect(relinked?.utility_id).toBe('utility-9');

    const cleared = await updateServiceRecordForContext(serviceContext, created.id, {
      service_title: 'Filter change',
      room_id: null,
      asset_id: null,
      utility_id: null
    });

    expect(cleared?.room_id).toBeNull();
    expect(cleared?.asset_id).toBeNull();
    expect(cleared?.utility_id).toBeNull();
  });
});
