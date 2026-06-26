import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel, SERVICE_TYPES, VISIBILITY_OPTIONS } from '@home-bible/shared';
import { Button, Card, EmptyState, PageHeader, UtilityBadge } from '@home-bible/ui';
import { detectTrendFlags, type IssueRecord, type ServiceRecord as TrendServiceRecord } from '../components/trendFlags';

type Room = { id: string; name: string };
type Asset = { id: string; name: string };
type Utility = { id: string; name: string };

type ServiceRecord = TrendServiceRecord & {
  property_id?: string | null;
  service_type: string;
  title: string;
  description?: string | null;
  cost?: number | null;
  vendor_name?: string | null;
  vendor_phone?: string | null;
  vendor_email?: string | null;
  follow_up_needed: boolean;
  visibility: string;
  created_at: string;
  updated_at: string;
};

function createLocalId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function RepairsPage() {
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [serviceType, setServiceType] = useState<(typeof SERVICE_TYPES)[number]>('maintenance');
  const [description, setDescription] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [cost, setCost] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [roomId, setRoomId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [utilityId, setUtilityId] = useState('');
  const [visibility, setVisibility] = useState<(typeof VISIBILITY_OPTIONS)[number]>('private');

  useEffect(() => {
    const storedRecords = window.localStorage.getItem('homeBible.serviceRecords');
    const storedIssues = window.localStorage.getItem('homeBible.issues');
    const storedRooms = window.localStorage.getItem('homeBible.rooms');
    const storedAssets = window.localStorage.getItem('homeBible.assets');
    const storedUtilities = window.localStorage.getItem('homeBible.utilities');

    if (storedRecords) {
      setRecords(JSON.parse(storedRecords));
    }

    if (storedIssues) {
      setIssues(JSON.parse(storedIssues));
    }

    if (storedRooms) {
      setRooms(JSON.parse(storedRooms));
    }

    if (storedAssets) {
      setAssets(JSON.parse(storedAssets));
    }

    if (storedUtilities) {
      setUtilities(JSON.parse(storedUtilities));
    }
  }, []);

  const trendFlags = useMemo(() => detectTrendFlags(records, issues), [records, issues]);

  const saveRecords = (next: ServiceRecord[]) => {
    setRecords(next);
    window.localStorage.setItem('homeBible.serviceRecords', JSON.stringify(next));
  };

  const submitRecord = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    if (!serviceDate) {
      setError('Service date is required.');
      return;
    }

    const newRecord: ServiceRecord = {
      id: createLocalId(),
      property_id: null,
      room_id: roomId || null,
      asset_id: assetId || null,
      utility_id: utilityId || null,
      service_type: serviceType,
      title: title.trim(),
      description: description.trim() || null,
      service_date: serviceDate,
      cost: cost ? Number(cost) : null,
      vendor_name: vendorName.trim() || null,
      vendor_phone: vendorPhone.trim() || null,
      vendor_email: vendorEmail.trim() || null,
      follow_up_needed: followUpNeeded,
      follow_up_date: followUpNeeded ? followUpDate || null : null,
      visibility,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    saveRecords([newRecord, ...records]);

    setTitle('');
    setDescription('');
    setServiceDate(new Date().toISOString().slice(0, 10));
    setCost('');
    setVendorName('');
    setVendorPhone('');
    setVendorEmail('');
    setFollowUpNeeded(false);
    setFollowUpDate('');
    setRoomId('');
    setAssetId('');
    setUtilityId('');
    setVisibility('private');
  };

  const deleteRecord = (id: string) => {
    saveRecords(records.filter((record) => record.id !== id));
  };

  const nameFromId = (list: Array<{ id: string; name: string }>, id?: string | null) => {
    if (!id) {
      return 'Not linked';
    }

    return list.find((item) => item.id === id)?.name || 'Unknown';
  };

  return (
    <>
      <PageHeader
        title="Repairs & Service Records"
        description="Track maintenance, inspections, repairs, and follow-up actions."
      />

      <Card>
        <h2 style={{ marginTop: 0 }}>Add service record</h2>
        <form onSubmit={submitRecord} style={{ display: 'grid', gap: 12 }}>
          {error && (
            <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: 10 }}>
              {error}
            </div>
          )}

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
          </label>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Service type</span>
              <select value={serviceType} onChange={(e) => setServiceType(e.target.value as (typeof SERVICE_TYPES)[number])} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                {SERVICE_TYPES.map((type) => (
                  <option key={type} value={type}>{formatEnumLabel(type)}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Service date</span>
              <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Cost</span>
              <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
            </label>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Room</span>
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                <option value="">Not linked</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Asset</span>
              <select value={assetId} onChange={(e) => setAssetId(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                <option value="">Not linked</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>{asset.name}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Utility</span>
              <select value={utilityId} onChange={(e) => setUtilityId(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                <option value="">Not linked</option>
                {utilities.map((utility) => (
                  <option key={utility.id} value={utility.id}>{utility.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db', minHeight: 80 }} />
          </label>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Vendor name</span>
              <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Vendor phone</span>
              <input value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Vendor email</span>
              <input type="email" value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input id="follow-up-needed" type="checkbox" checked={followUpNeeded} onChange={(e) => setFollowUpNeeded(e.target.checked)} />
            <label htmlFor="follow-up-needed" style={{ fontWeight: 600 }}>Follow-up needed</label>
          </div>

          {followUpNeeded && (
            <label style={{ display: 'grid', gap: 6, maxWidth: 260 }}>
              <span style={{ fontWeight: 600 }}>Follow-up date</span>
              <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
            </label>
          )}

          <label style={{ display: 'grid', gap: 6, maxWidth: 260 }}>
            <span style={{ fontWeight: 600 }}>Visibility</span>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as (typeof VISIBILITY_OPTIONS)[number])} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option} value={option}>{formatEnumLabel(option)}</option>
              ))}
            </select>
          </label>

          <div>
            <Button type="submit">Save service record</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 style={{ marginTop: 0 }}>Trend flags</h2>
        {trendFlags.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No trend flags currently. Keep logging service records for better trend insight.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {trendFlags.map((flag) => (
              <div key={flag.id} style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                <strong>{flag.label}</strong>
                <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>{flag.details}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {records.length === 0 ? (
        <EmptyState title="No service records yet" description="Add your first repair or maintenance record to start tracking your home's service history." />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {records
            .slice()
            .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime())
            .map((record) => (
              <Card key={record.id}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0' }}>{record.title}</h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <UtilityBadge label={formatEnumLabel(record.service_type)} />
                      {record.room_id && <UtilityBadge label={`Room: ${nameFromId(rooms, record.room_id)}`} />}
                      {record.asset_id && <UtilityBadge label={`Asset: ${nameFromId(assets, record.asset_id)}`} />}
                      {record.utility_id && <UtilityBadge label={`Utility: ${nameFromId(utilities, record.utility_id)}`} />}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                      <div><strong>Date:</strong> {record.service_date}</div>
                      {record.cost !== null && record.cost !== undefined && <div><strong>Cost:</strong> ${record.cost}</div>}
                      {record.vendor_name && <div><strong>Vendor:</strong> {record.vendor_name}</div>}
                      {record.follow_up_needed && (
                        <div><strong>Follow-up:</strong> {record.follow_up_date || 'Required'}</div>
                      )}
                      {record.description && <div><strong>Details:</strong> {record.description}</div>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteRecord(record.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      color: '#b91c1c',
                      cursor: 'pointer',
                      height: 'fit-content'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </Card>
            ))}
        </div>
      )}
    </>
  );
}
