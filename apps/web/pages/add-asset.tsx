import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { ASSET_TYPES, formatEnumLabel, type VisibilityContext } from '@home-folder/shared';
import { PageHeader, Card, Button } from '@home-folder/ui';
import { VisibilityContextPicker } from '../components/VisibilityContextPicker';
import {
  createAssetForContext,
  getAssetDataContext,
  type AssetDataContext,
  type AssetDataMode
} from '../lib/assets';
import { getDemoRooms } from '../lib/demoStorage';
import { scanPlatePhoto, type PlateScanResult } from '../lib/plateScan';
import { createReminderForContext, getReminderDataContext } from '../lib/reminders';
import { getRoomsForProperty } from '../lib/rooms';
import { formatRoomLocation } from '../lib/roomLabels';
import { usePropertyAccess } from '../lib/access';
import { ViewOnlyNotice } from '../components/ViewOnlyNotice';

type Room = {
  id: string;
  name: string;
  room_type?: string | null;
  floor_name?: string | null;
};

type AssetFormData = {
  asset_type: (typeof ASSET_TYPES)[number];
  name: string;
  brand: string;
  model: string;
  serial_number: string;
  purchase_date: string;
  purchase_price: string;
  retailer: string;
  warranty_length_months: string;
  warranty_expires_at: string;
  manual_url: string;
  support_url: string;
  notes: string;
  room_id: string;
  visibility_contexts: VisibilityContext[];
};

export default function AddAssetPage() {
  const access = usePropertyAccess();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [context, setContext] = useState<AssetDataContext | null>(null);
  const [dataMode, setDataMode] = useState<AssetDataMode>('demo');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(true);

  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanResult, setScanResult] = useState<PlateScanResult | null>(null);

  const [form, setForm] = useState<AssetFormData>({
    asset_type: 'appliance',
    name: '',
    brand: '',
    model: '',
    serial_number: '',
    purchase_date: '',
    purchase_price: '',
    retailer: '',
    warranty_length_months: '',
    warranty_expires_at: '',
    manual_url: '',
    support_url: '',
    notes: '',
    room_id: '',
    visibility_contexts: ['personal_archive']
  });

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setRoomsLoading(true);
      setError('');

      try {
        const nextContext = await getAssetDataContext();
        const roomList =
          nextContext.mode === 'supabase' && nextContext.property
            ? await getRoomsForProperty(nextContext.property.id)
            : getDemoRooms();

        if (!isMounted) {
          return;
        }

        setContext(nextContext);
        setDataMode(nextContext.mode);
        setRooms(roomList);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load rooms.');
        }
      } finally {
        if (isMounted) {
          setRoomsLoading(false);
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

  // Support deep links like /add-asset?type=tool&room=<id> from Tools & Inventory pages.
  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const presetType = typeof router.query.type === 'string' ? router.query.type : '';
    const presetRoom = typeof router.query.room === 'string' ? router.query.room : '';

    setForm((prev) => ({
      ...prev,
      asset_type: (ASSET_TYPES as readonly string[]).includes(presetType)
        ? (presetType as (typeof ASSET_TYPES)[number])
        : prev.asset_type,
      room_id: presetRoom || prev.room_id
    }));
  }, [router.isReady, router.query.type, router.query.room]);

  const handleInputChange = (field: keyof AssetFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Data-plate scan: photo → brand/model/serial prefilled. The scan only
  // prefills — the user always reviews before saving, because vision models
  // can misread stamped or worn labels.
  const handleScanFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setScanBusy(true);
    setScanError('');

    try {
      const result = await scanPlatePhoto(file);
      setScanResult(result);
      setForm((prev) => ({
        ...prev,
        brand: result.brand ?? prev.brand,
        model: result.model_number ?? prev.model,
        serial_number: result.serial_number ?? prev.serial_number
      }));
    } catch (scanFailure) {
      setScanResult(null);
      setScanError(scanFailure instanceof Error ? scanFailure.message : 'Could not scan that photo.');
    } finally {
      setScanBusy(false);
      if (scanInputRef.current) {
        scanInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!form.name.trim()) {
      setError('Asset name is required');
      setLoading(false);
      return;
    }

    if (!context) {
      setError('Asset details are still loading. Please try again.');
      setLoading(false);
      return;
    }

    try {
      const createdAsset = await createAssetForContext(context, {
        asset_type: form.asset_type,
        name: form.name.trim(),
        brand: form.brand || null,
        model: form.model || null,
        serial_number: form.serial_number || null,
        purchase_date: form.purchase_date || null,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
        retailer: form.retailer || null,
        warranty_length_months: form.warranty_length_months ? parseInt(form.warranty_length_months) : null,
        warranty_expires_at: form.warranty_expires_at || null,
        manual_url: form.manual_url || null,
        support_url: form.support_url || null,
        notes: form.notes || null,
        room_id: form.room_id || null,
        visibility_contexts: form.visibility_contexts
      });

      // Warranty auto-reminder: saving an asset with a warranty end date creates
      // a matching reminder. Best-effort — the asset save must never fail here.
      if (form.warranty_expires_at) {
        try {
          const reminderContext = await getReminderDataContext();
          await createReminderForContext(reminderContext, {
            title: `Warranty expires: ${form.name.trim()}`,
            description: 'Created automatically from the asset warranty date. Review coverage or plan a replacement before it lapses.',
            reminder_type: 'warranty',
            due_date: form.warranty_expires_at,
            priority: 'normal',
            source: 'warranty',
            asset_id: createdAsset?.id || null,
            room_id: form.room_id || null
          });
        } catch {
          // non-fatal: the asset saved; the user can add a reminder manually
        }
      }

      router.push('/assets');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save asset');
      setLoading(false);
    }
  };

  const inputStyles = {
    label: { display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 },
    input: {
      width: '100%',
      padding: 8,
      borderRadius: 6,
      border: '1px solid var(--border-subtle)',
      fontFamily: 'inherit',
      fontSize: '0.875rem'
    }
  };

  // A role that cannot write must not be offered the form. Showing it and
  // letting the save fail is how a viewer met a raw Postgres error.
  if (!access.loading && !access.canWrite) {
    return (
      <>
        <PageHeader title="Add appliance" />
        <ViewOnlyNotice role={access.role} action="add appliances" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Add asset" description="Add an appliance, tool, device, or other item worth keeping track of." />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? 'var(--status-good)' : 'var(--text-muted)' }}>
            {dataMode === 'supabase'
              ? 'Saved to your account.'
              : 'Demo data is stored only in this browser.'}
          </p>
          {dataMode === 'demo' && !context?.supabaseConfigured ? (
            <p style={{ marginTop: 10, marginBottom: 0, color: 'var(--color-clay)' }}>
              Account saving is not available in this local build. Demo data stays only in this browser.
            </p>
          ) : null}
          {dataMode === 'supabase' && context && !context.property ? (
            <p style={{ marginTop: 10, marginBottom: 0, color: 'var(--color-clay)' }}>
              Create a property before adding assets to your account.
            </p>
          ) : null}
        </Card>

        {dataMode === 'supabase' ? (
          <Card>
            <h2 style={{ marginTop: 0, marginBottom: 4 }}>Scan the data plate</h2>
            <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
              Take a photo of the appliance label and the brand, model, and serial number are filled in
              for you. Check the details against the label — scanning can misread.
            </p>
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(event) => handleScanFile(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={scanBusy}
              onClick={() => scanInputRef.current?.click()}
            >
              {scanBusy ? 'Reading the label…' : 'Scan the data plate'}
            </Button>
            {scanError ? (
              <p style={{ marginBottom: 0, color: 'var(--status-urgent)', fontSize: '0.875rem' }}>{scanError}</p>
            ) : null}
            {scanResult && !scanError ? (
              <p
                style={{
                  marginBottom: 0,
                  fontSize: '0.875rem',
                  color: scanResult.confidence === 'high' ? 'var(--status-good)' : 'var(--color-clay)'
                }}
              >
                {scanResult.confidence === 'high'
                  ? 'Details filled in below. Give them a once-over before saving.'
                  : `Details filled in below with ${scanResult.confidence} confidence — double-check each field against the label.`}
                {scanResult.notes ? ` ${scanResult.notes}` : ''}
              </p>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                padding: 12,
                marginBottom: 16,
                backgroundColor: 'rgba(163,78,51,0.12)',
                color: 'var(--status-urgent)',
                borderRadius: 6,
                fontSize: '0.875rem'
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gap: 16 }}>
            {/* Basic Info Section */}
            <div>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Basic details</h3>

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Asset type</label>
                  <select
                    value={form.asset_type}
                    onChange={(e) => handleInputChange('asset_type', e.target.value as (typeof ASSET_TYPES)[number])}
                    style={inputStyles.input as React.CSSProperties}
                  >
                    {ASSET_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {formatEnumLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Asset name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Kitchen refrigerator, Living room sofa"
                    style={inputStyles.input as React.CSSProperties}
                    required
                  />
                </div>

                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Room (optional)</label>
                  <select
                    value={form.room_id}
                    onChange={(e) => handleInputChange('room_id', e.target.value)}
                    style={inputStyles.input as React.CSSProperties}
                    disabled={roomsLoading}
                  >
                    <option value="">{roomsLoading ? 'Loading rooms...' : 'No room selected'}</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {formatRoomLocation(room)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Details Section */}
            <div>
              <h3 style={{ marginBottom: 12 }}>Product details</h3>

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Brand (optional)</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
                    placeholder="e.g., Samsung, LG"
                    style={inputStyles.input as React.CSSProperties}
                  />
                </div>

                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Model (optional)</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                    placeholder="e.g., RF28R7001SR"
                    style={inputStyles.input as React.CSSProperties}
                  />
                </div>

                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Serial number (optional)</label>
                  <input
                    type="text"
                    value={form.serial_number}
                    onChange={(e) => handleInputChange('serial_number', e.target.value)}
                    placeholder="e.g., ABC123XYZ"
                    style={inputStyles.input as React.CSSProperties}
                  />
                </div>
              </div>
            </div>

            {/* Purchase Info Section */}
            <div>
              <h3 style={{ marginBottom: 12 }}>Purchase details</h3>

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Purchase date (optional)</label>
                  <input
                    type="date"
                    value={form.purchase_date}
                    onChange={(e) => handleInputChange('purchase_date', e.target.value)}
                    style={inputStyles.input as React.CSSProperties}
                  />
                  {scanResult?.manufacture_year ? (
                    <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      The data plate suggests it was manufactured in {scanResult.manufacture_year} — a hint
                      if you don’t remember the purchase date.
                    </p>
                  ) : null}
                </div>

                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Purchase price (optional)</label>
                  <input
                    type="number"
                    value={form.purchase_price}
                    onChange={(e) => handleInputChange('purchase_price', e.target.value)}
                    placeholder="e.g., 1299.99"
                    step="0.01"
                    style={inputStyles.input as React.CSSProperties}
                  />
                </div>

                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Retailer (optional)</label>
                  <input
                    type="text"
                    value={form.retailer}
                    onChange={(e) => handleInputChange('retailer', e.target.value)}
                    placeholder="e.g., Best Buy, Amazon"
                    style={inputStyles.input as React.CSSProperties}
                  />
                </div>
              </div>
            </div>

            {/* Warranty Section */}
            <div>
              <h3 style={{ marginBottom: 12 }}>Warranty details</h3>

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Warranty length (months, optional)</label>
                  <input
                    type="number"
                    value={form.warranty_length_months}
                    onChange={(e) => handleInputChange('warranty_length_months', e.target.value)}
                    placeholder="e.g., 12"
                    style={inputStyles.input as React.CSSProperties}
                  />
                </div>

                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Warranty expires (optional)</label>
                  <input
                    type="date"
                    value={form.warranty_expires_at}
                    onChange={(e) => handleInputChange('warranty_expires_at', e.target.value)}
                    style={inputStyles.input as React.CSSProperties}
                  />
                </div>
              </div>
            </div>

            {/* Documentation Section */}
            <div>
              <h3 style={{ marginBottom: 12 }}>Documentation</h3>

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Manual URL (optional)</label>
                  <input
                    type="url"
                    value={form.manual_url}
                    onChange={(e) => handleInputChange('manual_url', e.target.value)}
                    placeholder="https://..."
                    style={inputStyles.input as React.CSSProperties}
                  />
                </div>

                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Support URL (optional)</label>
                  <input
                    type="url"
                    value={form.support_url}
                    onChange={(e) => handleInputChange('support_url', e.target.value)}
                    placeholder="https://..."
                    style={inputStyles.input as React.CSSProperties}
                  />
                </div>
              </div>
            </div>

            {/* Additional Info Section */}
            <div>
              <h3 style={{ marginBottom: 12 }}>Additional details</h3>

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <VisibilityContextPicker
                    idPrefix="asset-visibility-contexts"
                    value={form.visibility_contexts}
                    onChange={(value) => setForm((prev) => ({ ...prev, visibility_contexts: value }))}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Notes (optional)</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Any additional notes about this asset..."
                    style={{
                      width: '100%',
                      padding: 8,
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)',
                      fontFamily: 'inherit',
                      fontSize: '0.875rem',
                      minHeight: 80
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div style={{ display: 'flex', gap: 12, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
              <Button type="submit" disabled={loading || roomsLoading}>
                {loading ? 'Saving...' : 'Save asset'}
              </Button>

              <button
                type="button"
                onClick={() => router.push('/assets')}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'var(--surface-page)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
            </div>
          </div>
          </form>
        </Card>
      </div>
    </>
  );
}
