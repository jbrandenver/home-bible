import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-folder/shared';
import { PageHeader, Card, Button, EmptyState, Input, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { PhotoCaptureButton } from '../components/PhotoCaptureButton';
import {
  getAssetDataContext,
  getAssetsForContext,
  type AssetDataMode,
  type AssetRow
} from '../lib/assets';
import { getDocumentDataContext, type DocumentDataContext } from '../lib/documents';
import { getDemoRooms } from '../lib/demoStorage';
import { getRoomsForProperty } from '../lib/rooms';
import { formatRoomLocation } from '../lib/roomLabels';

type Room = {
  id: string;
  name: string;
  room_type?: string | null;
  floor_name?: string | null;
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatPrice(value: number | null) {
  return value === null || Number.isNaN(value) ? '—' : currency.format(value);
}

function csvEscape(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function InventoryPage() {
  const [dataMode, setDataMode] = useState<AssetDataMode>('demo');
  const [propertyNickname, setPropertyNickname] = useState('Your home');
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [documentContext, setDocumentContext] = useState<DocumentDataContext | null>(null);
  const [walkMode, setWalkMode] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const [context, docContext] = await Promise.all([
          getAssetDataContext(),
          getDocumentDataContext()
        ]);
        const [nextAssets, roomList] =
          context.mode === 'supabase' && context.property
            ? await Promise.all([
                getAssetsForContext(context),
                getRoomsForProperty(context.property.id)
              ])
            : [await getAssetsForContext(context), getDemoRooms()];

        if (!isMounted) {
          return;
        }

        setDataMode(context.mode);
        setDocumentContext(docContext);
        setPropertyNickname(context.property?.nickname || 'Your home');
        setAssets(nextAssets);
        setRooms(roomList as Room[]);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load the inventory.');
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

  const categories = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.asset_type))).sort(),
    [assets]
  );

  const filteredAssets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assets
      .filter((asset) => (categoryFilter ? asset.asset_type === categoryFilter : true))
      .filter((asset) => {
        if (!term) return true;
        return [asset.name, asset.brand, asset.model, asset.serial_number, asset.retailer]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
  }, [assets, categoryFilter, search]);

  const groupedByRoom = useMemo(() => {
    const groups = new Map<string, { label: string; items: AssetRow[]; subtotal: number }>();

    for (const asset of filteredAssets) {
      const room = asset.room_id ? roomById.get(asset.room_id) : null;
      const key = room ? room.id : 'unassigned';
      const label = room ? formatRoomLocation(room) : 'No room recorded';

      if (!groups.has(key)) {
        groups.set(key, { label, items: [], subtotal: 0 });
      }
      const group = groups.get(key)!;
      group.items.push(asset);
      group.subtotal += asset.purchase_price || 0;
    }

    for (const group of groups.values()) {
      group.items.sort((a, b) => a.name.localeCompare(b.name));
    }

    return Array.from(groups.entries()).sort(([keyA, a], [keyB, b]) => {
      if (keyA === 'unassigned') return 1;
      if (keyB === 'unassigned') return -1;
      return a.label.localeCompare(b.label);
    });
  }, [filteredAssets, roomById]);

  const stats = useMemo(() => {
    const total = filteredAssets.reduce((sum, asset) => sum + (asset.purchase_price || 0), 0);
    const withSerial = filteredAssets.filter((asset) => asset.serial_number).length;
    const withPrice = filteredAssets.filter((asset) => asset.purchase_price !== null).length;
    return { total, withSerial, withPrice, count: filteredAssets.length };
  }, [filteredAssets]);

  const handleExportCsv = () => {
    const header = [
      'Item', 'Category', 'Room', 'Brand', 'Model', 'Serial number',
      'Purchase date', 'Purchase price', 'Retailer', 'Notes'
    ];
    const lines = [header.join(',')];

    for (const asset of filteredAssets) {
      const room = asset.room_id ? roomById.get(asset.room_id) : null;
      lines.push(
        [
          csvEscape(asset.name),
          csvEscape(formatEnumLabel(asset.asset_type)),
          csvEscape(room ? formatRoomLocation(room) : ''),
          csvEscape(asset.brand),
          csvEscape(asset.model),
          csvEscape(asset.serial_number),
          csvEscape(asset.purchase_date),
          csvEscape(asset.purchase_price),
          csvEscape(asset.retailer),
          csvEscape(asset.notes)
        ].join(',')
      );
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'home-inventory.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="print-hide">
        <PageHeader
          eyebrow="Section III — Assets"
          title="Home Inventory"
          description="A room-by-room record of what you own — brands, serials, and values. If there's ever a fire, a flood, or a theft, this is your proof."
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <UtilityBadge label={`${stats.count} item${stats.count === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${formatPrice(stats.total)} documented`} variant="brassPale" />
            <UtilityBadge
              label={`${stats.withSerial}/${stats.count} serials logged`}
              tone={stats.count > 0 && stats.withSerial === stats.count ? 'good' : 'attention'}
            />
          </div>
        </PageHeader>
      </div>

      {/* print-only letterhead */}
      <div className="print-only" style={{ marginBottom: 20 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', margin: 0 }}>
          Our Home Folder — Home Inventory Record
        </p>
        <h1 style={{ margin: '4px 0 2px' }}>{propertyNickname}</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          {stats.count} items · {formatPrice(stats.total)} documented value
        </p>
        <div className="hb-double-rule" style={{ marginTop: 12 }} />
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        <Card className="print-hide">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
            <label style={{ flex: '1 1 220px' }}>
              <span>Search the inventory</span>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="TV, refrigerator, serial number…"
                style={{ marginTop: 6 }}
              />
            </label>
            <label style={{ flex: '0 1 220px' }}>
              <span>Category</span>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ marginTop: 6 }}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {formatEnumLabel(category)}
                  </option>
                ))}
              </Select>
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {dataMode === 'supabase' ? (
                <Button
                  variant={walkMode ? 'primary' : 'secondary'}
                  onClick={() => setWalkMode((current) => !current)}
                >
                  {walkMode ? '📷 Walk mode on' : '📷 Walk the house'}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => window.print()}>
                Print inventory
              </Button>
              <Button variant="secondary" onClick={handleExportCsv}>
                Export CSV
              </Button>
              <ActionLink href="/add-asset">Add an item</ActionLink>
            </div>
          </div>
          {walkMode ? (
            <p style={{ color: 'var(--color-brass-deep)', fontSize: 14, marginBottom: 0, fontWeight: 600 }}>
              Walk mode: a “Photo” button now sits on every item. Go room to room and snap each one —
              photos are compressed on your phone before upload.
            </p>
          ) : null}
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 0 }}>
            Tip: insurers ask for brand, model, serial number, and price. Items missing those are flagged so you can strengthen the record.
          </p>
        </Card>

        {error ? (
          <Card>
            <p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>{error}</p>
          </Card>
        ) : null}

        {loading ? (
          <Card>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Opening the inventory…</p>
          </Card>
        ) : filteredAssets.length === 0 ? (
          <EmptyState
            title="Nothing in the inventory yet"
            description="Walk one room with your phone and record the big-ticket items first — electronics, appliances, furniture. Ten minutes now is worth everything after a loss."
          />
        ) : (
          groupedByRoom.map(([key, group]) => (
            <section key={key}>
              <h2 className="hb-leader" style={{ paddingBottom: 6, marginBottom: 12 }}>
                {group.label}
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    color: 'var(--text-muted)'
                  }}
                >
                  {group.items.length} item{group.items.length === 1 ? '' : 's'} · {formatPrice(group.subtotal)}
                </span>
              </h2>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                    <thead>
                      <tr
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'var(--text-muted)',
                          textAlign: 'left'
                        }}
                      >
                        <th style={{ padding: '12px 14px 8px 24px' }}>Item</th>
                        <th style={{ padding: '12px 14px 8px' }}>Brand / Model</th>
                        <th style={{ padding: '12px 14px 8px' }}>Serial</th>
                        <th style={{ padding: '12px 14px 8px' }}>Purchased</th>
                        <th style={{ padding: '12px 24px 8px 14px', textAlign: 'right' }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((asset) => {
                        const missing: string[] = [];
                        if (!asset.serial_number) missing.push('serial');
                        if (asset.purchase_price === null) missing.push('value');

                        return (
                          <tr key={asset.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '10px 14px 10px 24px' }}>
                              <a href={`/assets/${asset.id}`} style={{ textDecoration: 'none', fontWeight: 600 }}>
                                {asset.name}
                              </a>
                              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                                {formatEnumLabel(asset.asset_type)}
                                {missing.length > 0 ? (
                                  <span className="print-hide" style={{ color: 'var(--status-attention)' }}>
                                    {' '}· add {missing.join(' & ')}
                                  </span>
                                ) : null}
                                {!walkMode ? (
                                  <span className="print-hide">
                                    {' '}·{' '}
                                    <a
                                      href={`/documents?assetId=${asset.id}`}
                                      style={{ color: 'var(--color-brass-deep)', textDecoration: 'none' }}
                                    >
                                      + photo
                                    </a>
                                  </span>
                                ) : null}
                              </div>
                              {walkMode ? (
                                <div className="print-hide" style={{ marginTop: 8 }}>
                                  <PhotoCaptureButton
                                    context={documentContext}
                                    linkField="asset_id"
                                    linkId={asset.id}
                                    title={`${asset.name} — inventory photo`}
                                    label="📷 Photo"
                                  />
                                </div>
                              ) : null}
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                              {[asset.brand, asset.model].filter(Boolean).join(' ') || '—'}
                            </td>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                              {asset.serial_number || '—'}
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                              {asset.purchase_date || '—'}
                            </td>
                            <td style={{ padding: '10px 24px 10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              {formatPrice(asset.purchase_price)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>
          ))
        )}

        {!loading && filteredAssets.length > 0 ? (
          <Card tone="dark">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ margin: 0 }}>Total documented value</h2>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', color: 'var(--color-brass-pale)' }}>
                {formatPrice(stats.total)}
              </span>
            </div>
            <p style={{ marginBottom: 0 }}>
              {stats.withPrice} of {stats.count} items have a recorded value. Photos and receipts attached to each item
              make claims faster — link them from the item's record.
            </p>
          </Card>
        ) : null}

        <Card className="print-hide">
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            {dataMode === 'supabase' ? 'Saved to your account.' : 'Demo data is stored only in this browser.'}{' '}
            Keep a printed copy somewhere safe outside the house, and revisit the record once a season.
          </p>
        </Card>
      </div>
    </>
  );
}
