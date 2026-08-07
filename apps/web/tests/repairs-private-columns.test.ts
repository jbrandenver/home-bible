import { describe, expect, it } from 'vitest';
import { REPAIR_PRIVATE_COLUMNS, REPAIR_SELECT } from '../lib/repairs';

// Migration 031 moved contractor contacts and costs off the repairs column
// grant; 043 finished the job with description and notes. The repairs RLS
// select policy is is_property_member, which is true for maintenance_guest,
// buyer_preview and insurance_view — so anything left in the grant is readable
// by a guest with an API client, no matter what lib/sharing.ts blanks in the
// UI. This test guards the client half of that boundary: naming a private
// column in REPAIR_SELECT would 403 the query for everyone, and quietly
// pressure someone into "fixing" it by re-granting the column.
describe('repairs private column boundary', () => {
  const selected = REPAIR_SELECT.split(',').map((column) => column.trim());

  it('never selects a withheld column from the base table', () => {
    for (const column of REPAIR_PRIVATE_COLUMNS) {
      expect(selected).not.toContain(column);
    }
  });

  it('still selects the columns the list and detail views sort and filter on', () => {
    // Server-side query shape from lib/repairs.ts: eq() on the three foreign
    // keys, order() on created_at. Losing one of these breaks reads outright.
    for (const column of ['id', 'property_id', 'asset_id', 'utility_id', 'created_at', 'deleted_at']) {
      expect(selected).toContain(column);
    }
  });

  it('lists every private column the RPC is responsible for returning', () => {
    // Mirrors get_repairs_private_fields' return table in migration 043. If a
    // column is added there, it belongs here too, or mergePrivateFields will
    // silently drop it and the field will read as "not recorded" for owners.
    expect([...REPAIR_PRIVATE_COLUMNS].sort()).toEqual([
      'actual_cost',
      'contractor_email',
      'contractor_name',
      'contractor_phone',
      'description',
      'estimated_cost',
      'notes'
    ]);
  });
});
