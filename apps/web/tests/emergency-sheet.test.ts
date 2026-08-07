import { beforeEach, describe, expect, it } from 'vitest';
import {
  describeSnapshotAge,
  readEmergencySnapshot,
  saveEmergencySnapshot
} from '../lib/emergencySheet';

// vitest runs these in node, so stand up the minimum localStorage the module
// touches. Keeping it real (rather than mocking the module) means the
// try/catch behaviour and the key naming are both actually exercised.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  keys() {
    return [...this.store.keys()];
  }
  clear() {
    this.store.clear();
  }
}

const storage = new MemoryStorage();

beforeEach(() => {
  storage.clear();
  (globalThis as unknown as { window: unknown }).window = { localStorage: storage };
});

const SAMPLE = {
  propertyName: 'The Beach House',
  utilities: [
    {
      id: 'u1',
      name: 'Main water shutoff',
      utility_type: 'main_water_shutoff',
      location_notes: 'Under the stairs, behind the coats',
      emergency_notes: 'Turn clockwise. Sticks — use the wrench on the hook.'
    }
  ],
  issues: [
    {
      id: 'i1',
      title: 'Slow leak under sink',
      issue_type: 'plumbing',
      status: 'open',
      description: 'Drip when the tap runs hot'
    }
  ]
};

describe('emergency sheet snapshot', () => {
  it('round-trips a saved sheet', () => {
    saveEmergencySnapshot('user-1', SAMPLE);
    const read = readEmergencySnapshot('user-1');

    expect(read?.propertyName).toBe('The Beach House');
    expect(read?.utilities).toHaveLength(1);
    expect(read?.utilities[0].emergency_notes).toContain('wrench');
    expect(read?.issues[0].title).toBe('Slow leak under sink');
    expect(typeof read?.savedAt).toBe('string');
  });

  it('scopes the snapshot per user so one account cannot read another\'s', () => {
    // Sign-out wipes these keys by prefix, but a crash or a killed tab skips
    // sign-out entirely. Scoping by user id means the next account still
    // cannot see the previous one's shutoff notes.
    saveEmergencySnapshot('user-1', SAMPLE);
    expect(readEmergencySnapshot('user-2')).toBeNull();
    expect(readEmergencySnapshot(null)).toBeNull();
  });

  it('uses a key prefix that sign-out already clears', () => {
    // lib/auth.ts::clearLocalHomeData removes everything starting with
    // `home-folder.` or `homeFolder.`. If this key ever drifts off those
    // prefixes, private emergency notes would survive sign-out.
    saveEmergencySnapshot('user-1', SAMPLE);
    const [key] = storage.keys();
    expect(key.startsWith('home-folder.')).toBe(true);
  });

  it('refuses to let an empty load wipe a good saved copy', () => {
    // The failure this guards is real and silent: the data layer swallows read
    // errors and returns [], and a half-resolved session queries as `anon` and
    // comes back empty rather than erroring. Caught in browser verification —
    // one degraded load replaced three shutoffs with a blank sheet.
    saveEmergencySnapshot('user-1', SAMPLE);
    saveEmergencySnapshot('user-1', { propertyName: 'The Beach House', utilities: [], issues: [] });

    const read = readEmergencySnapshot('user-1');
    expect(read?.utilities).toHaveLength(1);
    expect(read?.issues).toHaveLength(1);
  });

  it('still writes an empty sheet when there was nothing saved before', () => {
    // A genuinely empty home must not be stuck unable to save anything.
    saveEmergencySnapshot('user-1', { propertyName: 'New Place', utilities: [], issues: [] });
    expect(readEmergencySnapshot('user-1')?.propertyName).toBe('New Place');
  });

  it('lets a later non-empty load overwrite freely', () => {
    saveEmergencySnapshot('user-1', SAMPLE);
    saveEmergencySnapshot('user-1', {
      propertyName: 'The Beach House',
      utilities: [{ ...SAMPLE.utilities[0], id: 'u2', name: 'Gas shutoff' }],
      issues: []
    });
    expect(readEmergencySnapshot('user-1')?.utilities[0].name).toBe('Gas shutoff');
  });

  it('returns null rather than throwing on corrupt or stale-shaped data', () => {
    // The emergency page renders this during a failed load. Throwing here
    // would replace the fallback with a blank screen at the worst moment.
    storage.setItem('home-folder.emergency-sheet.v1.user-1', 'not json at all');
    expect(readEmergencySnapshot('user-1')).toBeNull();

    storage.setItem('home-folder.emergency-sheet.v1.user-1', JSON.stringify({ nope: true }));
    expect(readEmergencySnapshot('user-1')).toBeNull();
  });

  it('tolerates a snapshot whose arrays are missing', () => {
    storage.setItem(
      'home-folder.emergency-sheet.v1.user-1',
      JSON.stringify({ savedAt: new Date().toISOString() })
    );
    const read = readEmergencySnapshot('user-1');
    expect(read?.utilities).toEqual([]);
    expect(read?.issues).toEqual([]);
  });

  it('describes how old the copy is, because "is this current?" is the first question', () => {
    const now = new Date('2026-08-06T12:00:00Z');
    const at = (iso: string) => describeSnapshotAge(iso, now);

    expect(at('2026-08-06T11:59:30Z')).toBe('saved just now');
    expect(at('2026-08-06T11:45:00Z')).toBe('saved 15 minutes ago');
    expect(at('2026-08-06T09:00:00Z')).toBe('saved 3 hours ago');
    expect(at('2026-08-04T12:00:00Z')).toBe('saved 2 days ago');
    expect(at('not-a-date')).toBe('saved earlier');
  });
});
