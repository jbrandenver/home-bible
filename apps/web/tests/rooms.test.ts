import { beforeEach, describe, expect, it, vi } from 'vitest';

// Room deletion is a soft delete, so `on delete set null` never fires — the
// release pass in lib/rooms.ts is the only thing standing between a deleted
// room and a record whose location silently resolves to nothing. These tests
// pin three behaviours:
//   1. a soft delete that matches zero rows is reported as a failure, not a
//      success (the original bug: "removed" while the room stayed put);
//   2. every table that can carry room_id gets released, including the
//      FK-less reminders.linked_id and automation relationship endpoints;
//   3. getRoomLinkCounts reports only non-zero counts and survives a table
//      it cannot read.

type FakeResult = {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
};

type RecordedCall = {
  table: string;
  method: 'select' | 'update';
  payload?: Record<string, unknown>;
  filters: string[];
};

const calls: RecordedCall[] = [];

// Results are routed by "table:method". A function receives the recorded call
// so a test can vary the result per row filter.
let results: Record<string, FakeResult | ((call: RecordedCall) => FakeResult)>;

function resolveResult(call: RecordedCall): FakeResult {
  const configured = results[`${call.table}:${call.method}`];
  if (typeof configured === 'function') {
    return configured(call);
  }
  return configured ?? { data: [], error: null, count: 0 };
}

function makeBuilder(table: string) {
  const call: RecordedCall = { table, method: 'select', filters: [] };

  const builder = {
    select(_columns?: string, _options?: unknown) {
      // A select() after update() keeps the method as update — it only asks
      // PostgREST to return the touched rows.
      if (call.method !== 'update') {
        call.method = 'select';
      }
      return builder;
    },
    update(payload: Record<string, unknown>) {
      call.method = 'update';
      call.payload = payload;
      return builder;
    },
    eq(column: string, value: unknown) {
      call.filters.push(`eq:${column}=${String(value)}`);
      return builder;
    },
    is(column: string, value: unknown) {
      call.filters.push(`is:${column}=${String(value)}`);
      return builder;
    },
    or(expression: string) {
      call.filters.push(`or:${expression}`);
      return builder;
    },
    order() {
      return builder;
    },
    maybeSingle() {
      calls.push(call);
      const result = resolveResult(call);
      return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
    },
    then(
      onFulfilled: (value: { data: unknown; error: unknown; count: number | null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) {
      calls.push(call);
      const result = resolveResult(call);
      return Promise.resolve({
        data: result.data ?? null,
        error: result.error ?? null,
        count: result.count ?? null
      }).then(onFulfilled, onRejected);
    }
  };

  return builder;
}

vi.mock('../lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    from: (table: string) => makeBuilder(table)
  })
}));

const { deleteRoomForProperty, getRoomLinkCounts } = await import('../lib/rooms');

const PROPERTY = 'prop-1';
const ROOM = 'room-1';

const RELEASE_TABLES = [
  'utilities',
  'assets',
  'repairs',
  'reminders',
  'service_records',
  'issues',
  'systems',
  'documents',
  'receipts',
  'trend_flags',
  'automation_hubs',
  'automation_devices'
];

beforeEach(() => {
  calls.length = 0;
  results = {
    // The name lookup filters by room id; the post-delete list reload filters
    // by property only — they need different shapes.
    'rooms:select': (call) =>
      call.filters.includes(`eq:id=${ROOM}`) ? { data: { name: 'Office' } } : { data: [] },
    'rooms:update': { data: [{ id: ROOM }] },
    'floors:select': { data: [] },
    'automation_relationships:select': { data: [] }
  };
});

describe('deleteRoomForProperty', () => {
  it('treats a zero-row soft delete as a refusal and touches nothing else', async () => {
    results['rooms:update'] = { data: [] };

    await expect(deleteRoomForProperty(PROPERTY, ROOM)).rejects.toThrow(
      /could not be removed/
    );

    const releasedTables = calls.filter((call) => call.method === 'update' && call.table !== 'rooms');
    expect(releasedTables).toHaveLength(0);
  });

  it('releases room_id on every dependent table after a successful delete', async () => {
    await deleteRoomForProperty(PROPERTY, ROOM);

    for (const table of RELEASE_TABLES) {
      const release = calls.find(
        (call) =>
          call.table === table &&
          call.method === 'update' &&
          call.payload?.room_id === null &&
          call.filters.includes(`eq:room_id=${ROOM}`)
      );
      expect(release, `expected a room_id release on ${table}`).toBeTruthy();
    }
  });

  it('retargets FK-less reminder links from the room to the property', async () => {
    await deleteRoomForProperty(PROPERTY, ROOM);

    const retarget = calls.find(
      (call) =>
        call.table === 'reminders' &&
        call.method === 'update' &&
        call.payload?.linked_type === 'property' &&
        call.payload?.linked_id === PROPERTY &&
        call.filters.includes(`eq:linked_id=${ROOM}`)
    );
    expect(retarget).toBeTruthy();
  });

  it('releases automation relationship endpoints and keeps the room name as the label', async () => {
    results['automation_relationships:select'] = {
      data: [
        {
          id: 'rel-1',
          source_type: 'room',
          source_id: ROOM,
          source_label: null,
          target_type: 'device',
          target_id: 'dev-1',
          target_label: 'Lamp'
        }
      ]
    };

    await deleteRoomForProperty(PROPERTY, ROOM);

    const release = calls.find(
      (call) => call.table === 'automation_relationships' && call.method === 'update'
    );
    expect(release?.payload).toEqual({ source_id: null, source_label: 'Office' });
    expect(release?.filters).toContain('eq:id=rel-1');
  });
});

describe('getRoomLinkCounts', () => {
  it('reports only tables with records and survives an unreadable table', async () => {
    for (const table of RELEASE_TABLES) {
      results[`${table}:select`] = { count: 0 };
    }
    results['assets:select'] = { count: 3 };
    results['documents:select'] = { count: 1 };
    results['issues:select'] = { error: { message: 'permission denied' }, count: null };

    const counts = await getRoomLinkCounts(PROPERTY, ROOM);

    expect(counts).toEqual([
      { label: 'appliances & belongings', count: 3 },
      { label: 'documents & photos', count: 1 }
    ]);
  });
});
