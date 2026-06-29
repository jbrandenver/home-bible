import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ASSET_TYPES, formatEnumLabel, VISIBILITY_OPTIONS } from '@home-bible/shared';
import { PageHeader, Card, Button } from '@home-bible/ui';
import {
  createAssetForContext,
  getAssetDataContext,
  type AssetDataContext,
  type AssetDataMode
} from '../lib/assets';
import { getSupabaseSetupMessage } from '../lib/auth';
import { getDemoRooms } from '../lib/demoStorage';
import { getRoomsForProperty } from '../lib/rooms';

type Room = {
  id: string;
  name: string;
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
  visibility: (typeof VISIBILITY_OPTIONS)[number];
};

export default function AddAssetPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [context, setContext] = useState<AssetDataContext | null>(null);
  const [dataMode, setDataMode] = useState<AssetDataMode>('demo');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(true);

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
    visibility: 'private'
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
        setRooms(roomList.map((room) => ({ id: room.id, name: room.name })));
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

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleInputChange = (field: keyof AssetFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
      setError('Asset storage is still loading. Please try again.');
      setLoading(false);
      return;
    }

    try {
      await createAssetForContext(context, {
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
        visibility: form.visibility
      });

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
      border: '1px solid #d1d5db',
      fontFamily: 'inherit',
      fontSize: '0.875rem'
    }
  };

  return (
    <>
      <PageHeader title="Add Asset" description="Track appliances, tools, and other home items" />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? '#065f46' : '#6b7280' }}>
            {dataMode === 'supabase'
              ? 'Saved to your account.'
              : 'Demo data is stored only in this browser.'}
          </p>
          {dataMode === 'demo' && !context?.supabaseConfigured ? (
            <p style={{ marginTop: 10, marginBottom: 0, color: '#9a3412' }}>
              {getSupabaseSetupMessage()}
            </p>
          ) : null}
          {dataMode === 'supabase' && context && !context.property ? (
            <p style={{ marginTop: 10, marginBottom: 0, color: '#9a3412' }}>
              Create a property before adding assets to Supabase.
            </p>
          ) : null}
        </Card>

        <Card>
          <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                padding: 12,
                marginBottom: 16,
                backgroundColor: '#fee2e2',
                color: '#dc2626',
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
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Basic Information</h3>

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Asset Type</label>
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
                  <label style={inputStyles.label as React.CSSProperties}>Asset Name *</label>
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
                  <label style={inputStyles.label as React.CSSProperties}>Room (Optional)</label>
                  <select
                    value={form.room_id}
                    onChange={(e) => handleInputChange('room_id', e.target.value)}
                    style={inputStyles.input as React.CSSProperties}
                    disabled={roomsLoading}
                  >
                    <option value="">{roomsLoading ? 'Loading rooms...' : 'No room selected'}</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Details Section */}
            <div>
              <h3 style={{ marginBottom: 12 }}>Product Details</h3>

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Brand (Optional)</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
                    placeholder="e.g., Samsung, LG"
                    style={inputStyles.input as React.CSSProperties}
                  />
                </div>

                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Model (Optional)</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                    placeholder="e.g., RF28R7001SR"
                    style={inputStyles.input as React.CSSProperties}
                  />
                </div>

                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Serial Number (Optional)</label>
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
              <h3 style={{ marginBottom: 12 }}>Purchase Information</h3>

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Purchase Date (Optional)</label>
                  <input
                    type="date"
                    value={form.purchase_date}
                    onChange={(e) => handleInputChange('purchase_date', e.target.value)}
                    style={inputStyles.input as React.CSSProperties}
                  />
                </div>

                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Purchase Price (Optional)</label>
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
                  <label style={inputStyles.label as React.CSSProperties}>Retailer (Optional)</label>
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
              <h3 style={{ marginBottom: 12 }}>Warranty Information</h3>

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Warranty Length (months, optional)</label>
                  <input
                    type="number"
                    value={form.warranty_length_months}
                    onChange={(e) => handleInputChange('warranty_length_months', e.target.value)}
                    placeholder="e.g., 12"
                    style={inputStyles.input as React.CSSProperties}
                  />
                </div>

                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Warranty Expires At (Optional)</label>
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
                  <label style={inputStyles.label as React.CSSProperties}>Manual URL (Optional)</label>
                  <input
                    type="url"
                    value={form.manual_url}
                    onChange={(e) => handleInputChange('manual_url', e.target.value)}
                    placeholder="https://..."
                    style={inputStyles.input as React.CSSProperties}
                  />
                </div>

                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Support URL (Optional)</label>
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
              <h3 style={{ marginBottom: 12 }}>Additional Information</h3>

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Visibility</label>
                  <select
                    value={form.visibility}
                    onChange={(e) => handleInputChange('visibility', e.target.value as (typeof VISIBILITY_OPTIONS)[number])}
                    style={inputStyles.input as React.CSSProperties}
                  >
                    {VISIBILITY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {formatEnumLabel(opt)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={inputStyles.label as React.CSSProperties}>Notes (Optional)</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Any additional notes about this asset..."
                    style={{
                      width: '100%',
                      padding: 8,
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      fontFamily: 'inherit',
                      fontSize: '0.875rem',
                      minHeight: 80
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div style={{ display: 'flex', gap: 12, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
              <Button type="submit" disabled={loading || roomsLoading}>
                {loading ? 'Saving...' : 'Save Asset'}
              </Button>

              <button
                type="button"
                onClick={() => router.push('/assets')}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#f3f4f6',
                  color: '#1f2937',
                  border: '1px solid #d1d5db',
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
