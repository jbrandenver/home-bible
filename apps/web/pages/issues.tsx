import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel, ISSUE_SEVERITIES, ISSUE_STATUSES, ISSUE_TYPES, VISIBILITY_OPTIONS } from '@home-bible/shared';
import { Button, Card, EmptyState, PageHeader, UtilityBadge } from '@home-bible/ui';

type Room = { id: string; name: string };
type Asset = { id: string; name: string };
type Utility = { id: string; name: string };

type IssueRecord = {
  id: string;
  property_id?: string | null;
  room_id?: string | null;
  asset_id?: string | null;
  utility_id?: string | null;
  issue_type: string;
  title: string;
  description?: string | null;
  status: string;
  severity: string;
  date_found: string;
  resolution_date?: string | null;
  private_notes?: string | null;
  shareable_notes?: string | null;
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

export default function IssuesPage() {
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [issueType, setIssueType] = useState<(typeof ISSUE_TYPES)[number]>('other');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<(typeof ISSUE_STATUSES)[number]>('open');
  const [severity, setSeverity] = useState<(typeof ISSUE_SEVERITIES)[number]>('medium');
  const [dateFound, setDateFound] = useState(new Date().toISOString().slice(0, 10));
  const [resolutionDate, setResolutionDate] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [shareableNotes, setShareableNotes] = useState('');
  const [roomId, setRoomId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [utilityId, setUtilityId] = useState('');
  const [visibility, setVisibility] = useState<(typeof VISIBILITY_OPTIONS)[number]>('private');

  useEffect(() => {
    const storedIssues = window.localStorage.getItem('homeBible.issues');
    const storedRooms = window.localStorage.getItem('homeBible.rooms');
    const storedAssets = window.localStorage.getItem('homeBible.assets');
    const storedUtilities = window.localStorage.getItem('homeBible.utilities');

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

  const openIssueCount = useMemo(
    () => issues.filter((issue) => issue.status !== 'resolved' && issue.status !== 'archived').length,
    [issues]
  );

  const saveIssues = (next: IssueRecord[]) => {
    setIssues(next);
    window.localStorage.setItem('homeBible.issues', JSON.stringify(next));
  };

  const submitIssue = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    if (!dateFound) {
      setError('Date found is required.');
      return;
    }

    const newIssue: IssueRecord = {
      id: createLocalId(),
      property_id: null,
      room_id: roomId || null,
      asset_id: assetId || null,
      utility_id: utilityId || null,
      issue_type: issueType,
      title: title.trim(),
      description: description.trim() || null,
      status,
      severity,
      date_found: dateFound,
      resolution_date: resolutionDate || null,
      private_notes: privateNotes.trim() || null,
      shareable_notes: shareableNotes.trim() || null,
      visibility,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    saveIssues([newIssue, ...issues]);

    setTitle('');
    setIssueType('other');
    setDescription('');
    setStatus('open');
    setSeverity('medium');
    setDateFound(new Date().toISOString().slice(0, 10));
    setResolutionDate('');
    setPrivateNotes('');
    setShareableNotes('');
    setRoomId('');
    setAssetId('');
    setUtilityId('');
    setVisibility('private');
  };

  const deleteIssue = (id: string) => {
    saveIssues(issues.filter((issue) => issue.id !== id));
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
        title="Issues"
        description="Track observed issues and their progress with calm, practical notes."
      />

      <Card>
        <h2 style={{ marginTop: 0 }}>Add issue</h2>
        <form onSubmit={submitIssue} style={{ display: 'grid', gap: 12 }}>
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
              <span style={{ fontWeight: 600 }}>Issue type</span>
              <select value={issueType} onChange={(e) => setIssueType(e.target.value as (typeof ISSUE_TYPES)[number])} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                {ISSUE_TYPES.map((type) => (
                  <option key={type} value={type}>{formatEnumLabel(type)}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as (typeof ISSUE_STATUSES)[number])} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                {ISSUE_STATUSES.map((value) => (
                  <option key={value} value={value}>{formatEnumLabel(value)}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Severity</span>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as (typeof ISSUE_SEVERITIES)[number])} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                {ISSUE_SEVERITIES.map((value) => (
                  <option key={value} value={value}>{formatEnumLabel(value)}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Date found</span>
              <input type="date" value={dateFound} onChange={(e) => setDateFound(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
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

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Resolution date</span>
              <input type="date" value={resolutionDate} onChange={(e) => setResolutionDate(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db', minHeight: 70 }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Private notes</span>
            <textarea value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db', minHeight: 70 }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Shareable notes</span>
            <textarea value={shareableNotes} onChange={(e) => setShareableNotes(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db', minHeight: 70 }} />
          </label>

          <label style={{ display: 'grid', gap: 6, maxWidth: 260 }}>
            <span style={{ fontWeight: 600 }}>Visibility</span>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as (typeof VISIBILITY_OPTIONS)[number])} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option} value={option}>{formatEnumLabel(option)}</option>
              ))}
            </select>
          </label>

          <div>
            <Button type="submit">Save issue</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 style={{ marginTop: 0 }}>Issue overview</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <UtilityBadge label={`${openIssueCount} open`} />
          <UtilityBadge label={`${issues.filter((issue) => issue.severity === 'urgent' && issue.status !== 'resolved' && issue.status !== 'archived').length} urgent open`} />
        </div>
      </Card>

      {issues.length === 0 ? (
        <EmptyState title="No issues yet" description="Add your first issue to track status and resolution progress." />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {issues
            .slice()
            .sort((a, b) => new Date(b.date_found).getTime() - new Date(a.date_found).getTime())
            .map((issue) => (
              <Card key={issue.id}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0' }}>{issue.title}</h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <UtilityBadge label={formatEnumLabel(issue.issue_type)} />
                      <UtilityBadge label={formatEnumLabel(issue.status)} />
                      <UtilityBadge label={formatEnumLabel(issue.severity)} />
                      {issue.room_id && <UtilityBadge label={`Room: ${nameFromId(rooms, issue.room_id)}`} />}
                      {issue.asset_id && <UtilityBadge label={`Asset: ${nameFromId(assets, issue.asset_id)}`} />}
                      {issue.utility_id && <UtilityBadge label={`Utility: ${nameFromId(utilities, issue.utility_id)}`} />}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                      <div><strong>Date found:</strong> {issue.date_found}</div>
                      {issue.resolution_date && <div><strong>Resolution date:</strong> {issue.resolution_date}</div>}
                      {issue.description && <div><strong>Description:</strong> {issue.description}</div>}
                      {issue.private_notes && <div><strong>Private notes:</strong> {issue.private_notes}</div>}
                      {issue.shareable_notes && <div><strong>Shareable notes:</strong> {issue.shareable_notes}</div>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteIssue(issue.id)}
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
