import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader, Card, Button, ConfirmDialog, EmptyState, Input, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import {
  createAssetForContext,
  deleteAssetForContext,
  getAssetDataContext,
  getAssetsForContext,
  type AssetDataContext,
  type AssetDataMode,
  type AssetRow
} from '../lib/assets';
import { getDemoRooms } from '../lib/demoStorage';
import { getRoomsForProperty } from '../lib/rooms';
import { formatRoomLocation } from '../lib/roomLabels';

type Room = {
  id: string;
  name: string;
  room_type?: string | null;
  floor_name?: string | null;
};

// Rooms that count as tool storage — the garage wall, the shed shelf, the basement bench.
const STORAGE_ROOM_TYPES = new Set([
  'garage',
  'shed',
  'utility_room',
  'basement',
  'attic',
  'closet',
  'crawl_space',
  'laundry_room'
]);

const TOOL_ASSET_TYPES = new Set(['tool', 'outdoor_equipment']);

export default function ToolsPage() {
  const [context, setContext] = useState<AssetDataContext | null>(null);
  const [dataMode, setDataMode] = useState<AssetDataMode>('demo');
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Two-step removal: the Remove button only opens a ConfirmDialog; nothing is
  // removed until the dialog is confirmed. window.confirm proved unreliable
  // (a suppressed dialog returns false and the click dies silently).
  const [toolDeleteTarget, setToolDeleteTarget] = useState<AssetRow | null>(null);
  const [search, setSearch] = useState('');
  const [includeOutdoor, setIncludeOutdoor] = useState(true);

  // quick-add form
  const [toolName, setToolName] = useState('');
  const [toolBrand, setToolBrand] = useState('');
  const [toolRoomId, setToolRoomId] = useState('');
  const [toolNotes, setToolNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const nextContext = await getAssetDataContext();
        const [nextAssets, roomList] =
          nextContext.mode === 'supabase' && nextContext.property
            ? await Promise.all([
                getAssetsForContext(nextContext),
                getRoomsForProperty(nextContext.property.id)
              ])
            : [await getAssetsForContext(nextContext), getDemoRooms()];

        if (!isMounted) {
          return;
        }

        setContext(nextContext);
        setDataMode(nextContext.mode);
        setAssets(nextAssets);
        setRooms(roomList as Room[]);

        // Default the quick-add location to the first storage room (garage first).
        const storageRooms = (roomList as Room[]).filter((room) =>
          STORAGE_ROOM_TYPES.has(room.room_type || '')
        );
        const garage = storageRooms.find((room) => room.room_type === 'garage');
        setToolRoomId((current) => current || garage?.id || storageRooms[0]?.id || '');
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load tools.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load().catch((err) => {
      if (isMounted) {
        setError(err instanceof Error ? err.message : 'Failed to load data.');
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);

  const storageRooms = useMemo(
    () => rooms.filter((room) => STORAGE_ROOM_TYPES.has(room.room_type || '')),
    [rooms]
  );

  const tools = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assets
      .filter((asset) =>
        includeOutdoor ? TOOL_ASSET_TYPES.has(asset.asset_type) : asset.asset_type === 'tool'
      )
      .filter((asset) => {
        if (!term) return true;
        return [asset.name, asset.brand, asset.model, asset.notes]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assets, includeOutdoor, search]);

  const groupedTools = useMemo(() => {
    const groups = new Map<string, { label: string; isStorage: boolean; items: AssetRow[] }>();

    for (const tool of tools) {
      const room = tool.room_id ? roomById.get(tool.room_id) : null;
      const key = room ? room.id : 'unassigned';
      const label = room ? formatRoomLocation(room) : 'No location recorded';
      const isStorage = room ? STORAGE_ROOM_TYPES.has(room.room_type || '') : false;

      if (!groups.has(key)) {
        groups.set(key, { label, isStorage, items: [] });
      }
      groups.get(key)!.items.push(tool);
    }

    // storage areas first, then other rooms, then unassigned last
    return Array.from(groups.entries()).sort(([keyA, a], [keyB, b]) => {
      if (keyA === 'unassigned') return 1;
      if (keyB === 'unassigned') return -1;
      if (a.isStorage !== b.isStorage) return a.isStorage ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
  }, [tools, roomById]);

  const unassignedCount = useMemo(
    () => tools.filter((tool) => !tool.room_id || !roomById.get(tool.room_id)).length,
    [tools, roomById]
  );

  const handleQuickAdd = async () => {
    if (!context) return;

    const name = toolName.trim();
    if (!name) {
      setFormError('Give the tool a name first.');
      return;
    }

    setSaving(true);
    setFormError('');
    setSavedMessage('');

    try {
      await createAssetForContext(context, {
        asset_type: 'tool',
        name,
        brand: toolBrand.trim() || null,
        room_id: toolRoomId || null,
        notes: toolNotes.trim() || null
      });

      // reload the list from the source of truth
      const nextAssets = await getAssetsForContext(context);
      setAssets(nextAssets);
      setToolName('');
      setToolBrand('');
      setToolNotes('');
      setSavedMessage(`“${name}” added to the tool record.`);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to save the tool.');
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (tool: AssetRow) => {
    setError('');
    setToolDeleteTarget(tool);
  };

  const cancelDelete = () => {
    if (deletingId !== null) return;
    setToolDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!context || !toolDeleteTarget || deletingId !== null) return;

    const toolId = toolDeleteTarget.id;

    setDeletingId(toolId);
    setError('');

    try {
      await deleteAssetForContext(context, toolId);
      setAssets((current) => current.filter((asset) => asset.id !== toolId));
      setToolDeleteTarget(null);
    } catch (deleteError) {
      // Close the dialog so the error is readable on the page.
      setToolDeleteTarget(null);
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete the tool.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Section III — Assets"
        title="The Tool Shed"
        description="Every tool in the house, recorded where it lives — the garage wall, the shed shelf, the utility closet."
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <UtilityBadge label={`${tools.length} tool${tools.length === 1 ? '' : 's'} recorded`} />
          <UtilityBadge label={`${storageRooms.length} storage area${storageRooms.length === 1 ? '' : 's'}`} />
          {unassignedCount > 0 ? (
            <UtilityBadge label={`${unassignedCount} without a home`} tone="attention" />
          ) : null}
        </div>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>Add a tool</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Quick entry — name it, shelve it. Add serial numbers, value, and warranty later from its record.
          </p>
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              alignItems: 'end'
            }}
          >
            <label>
              <span>Tool name</span>
              <Input
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                placeholder="Cordless drill"
                style={{ marginTop: 6 }}
              />
            </label>
            <label>
              <span>Brand (optional)</span>
              <Input
                value={toolBrand}
                onChange={(e) => setToolBrand(e.target.value)}
                placeholder="DeWalt"
                style={{ marginTop: 6 }}
              />
            </label>
            <label>
              <span>Kept in</span>
              <Select
                value={toolRoomId}
                onChange={(e) => setToolRoomId(e.target.value)}
                style={{ marginTop: 6 }}
              >
                <option value="">No location yet</option>
                {storageRooms.length > 0 ? (
                  <optgroup label="Storage areas">
                    {storageRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {formatRoomLocation(room)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <optgroup label="Other rooms">
                  {rooms
                    .filter((room) => !STORAGE_ROOM_TYPES.has(room.room_type || ''))
                    .map((room) => (
                      <option key={room.id} value={room.id}>
                        {formatRoomLocation(room)}
                      </option>
                    ))}
                </optgroup>
              </Select>
            </label>
            <label>
              <span>Notes (optional)</span>
              <Input
                value={toolNotes}
                onChange={(e) => setToolNotes(e.target.value)}
                placeholder="Top shelf, red case"
                style={{ marginTop: 6 }}
              />
            </label>
            <Button onClick={handleQuickAdd} disabled={saving}>
              {saving ? 'Recording…' : 'Record tool'}
            </Button>
          </div>
          {formError ? (
            <p style={{ color: 'var(--status-urgent)', fontWeight: 700, marginBottom: 0 }}>{formError}</p>
          ) : null}
          {savedMessage ? (
            <p style={{ color: 'var(--status-good)', fontWeight: 700, marginBottom: 0 }}>{savedMessage}</p>
          ) : null}
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 0 }}>
            Need the full form (serial, value, warranty)?{' '}
            <Link href="/add-asset?type=tool" style={{ color: 'var(--color-brass-deep)' }}>
              Add with details
            </Link>
            .
          </p>
        </Card>

        <Card>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
            <label style={{ flex: '1 1 220px' }}>
              <span>Search tools</span>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="drill, ladder, mower…"
                style={{ marginTop: 6 }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12 }}>
              <input
                type="checkbox"
                checked={includeOutdoor}
                onChange={(e) => setIncludeOutdoor(e.target.checked)}
              />
              <span>Include outdoor equipment</span>
            </label>
          </div>
        </Card>

        {error ? (
          <Card>
            <p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>{error}</p>
          </Card>
        ) : null}

        {loading ? (
          <Card>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Opening the tool record…</p>
          </Card>
        ) : tools.length === 0 ? (
          <EmptyState
            title="No tools recorded yet"
            description="Start with the ones you'd hate to lose — the drill, the ladder, the mower. Record each one where it lives."
          />
        ) : (
          groupedTools.map(([key, group]) => (
            <section key={key}>
              <h2 className="hb-leader" style={{ paddingBottom: 6, marginBottom: 14 }}>
                {group.label}
                {group.isStorage ? (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--color-brass-deep)'
                    }}
                  >
                    Storage area
                  </span>
                ) : null}
              </h2>
              <div style={{ display: 'grid', gap: 12 }}>
                {group.items.map((tool) => (
                  <Card key={tool.id} interactive style={{ padding: '16px 16px 16px 24px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: 12,
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
                          <Link href={`/assets/${tool.id}`} style={{ textDecoration: 'none' }}>
                            {tool.name}
                          </Link>
                        </strong>
                        <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 2 }}>
                          {[tool.brand, tool.model].filter(Boolean).join(' · ') || '—'}
                          {tool.notes ? ` — ${tool.notes}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {tool.asset_type === 'outdoor_equipment' ? (
                          <UtilityBadge label="Outdoor" />
                        ) : null}
                        {tool.serial_number ? <UtilityBadge label="Serial logged" tone="good" /> : null}
                        <ActionLink href={`/assets/${tool.id}`} variant="secondary">
                          Open record
                        </ActionLink>
                        <Button
                          variant="secondary"
                          onClick={() => requestDelete(tool)}
                          disabled={deletingId === tool.id}
                          style={{ color: 'var(--status-urgent)', borderColor: 'var(--status-urgent)' }}
                        >
                          {deletingId === tool.id ? 'Removing…' : 'Remove'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}

        <Card>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            {dataMode === 'supabase'
              ? 'Saved to your account.'
              : 'Demo data is stored only in this browser.'}{' '}
            Tools also appear in your <Link href="/inventory" style={{ color: 'var(--color-brass-deep)' }}>home inventory</Link> for insurance records.
          </p>
        </Card>
      </div>

      <ConfirmDialog
        open={toolDeleteTarget !== null}
        title={toolDeleteTarget ? `Remove ${toolDeleteTarget.name}?` : 'Remove tool?'}
        description="This removes it from the tool record. This cannot be undone."
        confirmLabel="Remove tool"
        cancelLabel="Keep tool"
        busy={deletingId !== null && deletingId === toolDeleteTarget?.id}
        onConfirm={handleConfirmDelete}
        onCancel={cancelDelete}
      />
    </>
  );
}
