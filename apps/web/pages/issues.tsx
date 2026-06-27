import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  formatEnumLabel,
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  ISSUE_TYPES,
  TREND_FLAG_DETECTED_FROM,
  TREND_FLAG_STATUSES,
  TREND_FLAG_TYPES
} from '@home-bible/shared';
import { Button, Card, EmptyState, PageHeader, UtilityBadge } from '@home-bible/ui';
import { getAssetsForProperty, getDemoAssets, type AssetRow } from '../lib/assets';
import { getDemoRooms } from '../lib/demoStorage';
import {
  createIssueForContext,
  deleteIssueForContext,
  getIssueDataContext,
  getIssuesForContext,
  updateIssueStatusForContext,
  type IssueDataContext,
  type IssueRow,
  type IssueSeverity,
  type IssueStatus,
  type IssueType
} from '../lib/issues';
import { getRepairsForProperty, getDemoRepairs, type RepairRow } from '../lib/repairs';
import { getRoomsForProperty } from '../lib/rooms';
import {
  createTrendFlagForContext,
  deleteTrendFlagForContext,
  getTrendFlagDataContext,
  getTrendFlagsForContext,
  updateTrendFlagStatusForContext,
  type TrendFlagDataContext,
  type TrendFlagDetectedFrom,
  type TrendFlagRow,
  type TrendFlagSeverity,
  type TrendFlagStatus,
  type TrendFlagType
} from '../lib/trendFlags';
import { getDemoUtilities, getUtilitiesForProperty, type UtilityRow } from '../lib/utilities';

type LinkOption = {
  id: string;
  name: string;
};

const fieldStyle = {
  padding: 10,
  borderRadius: 8,
  border: '1px solid #d1d5db'
};

const destructiveButtonStyle = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #fecaca',
  background: '#fef2f2',
  color: '#b91c1c',
  cursor: 'pointer'
};

function nameFromId(list: LinkOption[], id?: string | null) {
  if (!id) {
    return null;
  }

  return list.find((item) => item.id === id)?.name || 'Unknown';
}

function issueTitleFromId(issues: IssueRow[], id?: string | null) {
  if (!id) {
    return null;
  }

  return issues.find((issue) => issue.id === id)?.title || 'Unknown';
}

export default function IssuesPage() {
  const [issueContext, setIssueContext] = useState<IssueDataContext | null>(null);
  const [trendContext, setTrendContext] = useState<TrendFlagDataContext | null>(null);
  const [dataMode, setDataMode] = useState<'demo' | 'supabase'>('demo');
  const [hasProperty, setHasProperty] = useState(false);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [trendFlags, setTrendFlags] = useState<TrendFlagRow[]>([]);
  const [rooms, setRooms] = useState<LinkOption[]>([]);
  const [assets, setAssets] = useState<LinkOption[]>([]);
  const [utilities, setUtilities] = useState<LinkOption[]>([]);
  const [repairs, setRepairs] = useState<LinkOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [savingIssue, setSavingIssue] = useState(false);
  const [savingTrendFlag, setSavingTrendFlag] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [issueStatusFilter, setIssueStatusFilter] = useState('');
  const [issueSeverityFilter, setIssueSeverityFilter] = useState('');
  const [issueTypeFilter, setIssueTypeFilter] = useState('');
  const [issueLinkFilter, setIssueLinkFilter] = useState('');
  const [issueSearch, setIssueSearch] = useState('');
  const [issueSortBy, setIssueSortBy] = useState<'severity' | 'first_seen_date' | 'last_seen_date' | 'status'>('first_seen_date');
  const [flagStatusFilter, setFlagStatusFilter] = useState('');
  const [flagSeverityFilter, setFlagSeverityFilter] = useState('');
  const [flagTypeFilter, setFlagTypeFilter] = useState('');
  const [flagLinkFilter, setFlagLinkFilter] = useState('');
  const [flagSearch, setFlagSearch] = useState('');
  const [flagSortBy, setFlagSortBy] = useState<'severity' | 'first_detected_at' | 'last_detected_at' | 'status'>('first_detected_at');

  const [title, setTitle] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('general');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<IssueStatus>('open');
  const [severity, setSeverity] = useState<IssueSeverity>('medium');
  const [firstSeenDate, setFirstSeenDate] = useState(new Date().toISOString().slice(0, 10));
  const [lastSeenDate, setLastSeenDate] = useState('');
  const [resolvedDate, setResolvedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [roomId, setRoomId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [utilityId, setUtilityId] = useState('');
  const [repairId, setRepairId] = useState('');

  const [flagTitle, setFlagTitle] = useState('');
  const [flagType, setFlagType] = useState<TrendFlagType>('manual_flag');
  const [flagSeverity, setFlagSeverity] = useState<TrendFlagSeverity>('medium');
  const [flagStatus, setFlagStatus] = useState<TrendFlagStatus>('active');
  const [detectedFrom, setDetectedFrom] = useState<TrendFlagDetectedFrom>('manual');
  const [flagDescription, setFlagDescription] = useState('');
  const [flagRoomId, setFlagRoomId] = useState('');
  const [flagAssetId, setFlagAssetId] = useState('');
  const [flagUtilityId, setFlagUtilityId] = useState('');
  const [flagIssueId, setFlagIssueId] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setLoadError('');
      setFormError('');

      const errors: string[] = [];
      const [nextIssueContext, nextTrendContext] = await Promise.all([
        getIssueDataContext(),
        getTrendFlagDataContext()
      ]);
      let nextIssues: IssueRow[] = [];
      let nextTrendFlags: TrendFlagRow[] = [];
      let nextRooms: LinkOption[] = [];
      let nextAssets: LinkOption[] = [];
      let nextUtilities: LinkOption[] = [];
      let nextRepairs: LinkOption[] = [];

      try {
        nextIssues = await getIssuesForContext(nextIssueContext);
      } catch (loadIssuesError) {
        errors.push(loadIssuesError instanceof Error ? loadIssuesError.message : 'Failed to load issues.');
      }

      try {
        nextTrendFlags = await getTrendFlagsForContext(nextTrendContext);
      } catch (loadFlagsError) {
        errors.push(loadFlagsError instanceof Error ? loadFlagsError.message : 'Failed to load trend flags.');
      }

      try {
        if (nextIssueContext.mode === 'supabase' && nextIssueContext.property) {
          const [roomRows, assetRows, utilityRows, repairRows] = await Promise.all([
            getRoomsForProperty(nextIssueContext.property.id),
            getAssetsForProperty(nextIssueContext.property.id),
            getUtilitiesForProperty(nextIssueContext.property.id),
            getRepairsForProperty(nextIssueContext.property.id)
          ]);

          nextRooms = roomRows.map((room) => ({ id: room.id, name: room.name }));
          nextAssets = assetRows.map((asset: AssetRow) => ({ id: asset.id, name: asset.name }));
          nextUtilities = utilityRows.map((utility: UtilityRow) => ({ id: utility.id, name: utility.name }));
          nextRepairs = repairRows.map((repair: RepairRow) => ({ id: repair.id, name: repair.title }));
        } else {
          nextRooms = getDemoRooms().map((room) => ({ id: room.id, name: room.name }));
          nextAssets = getDemoAssets().map((asset) => ({ id: asset.id, name: asset.name }));
          nextUtilities = getDemoUtilities().map((utility) => ({ id: utility.id, name: utility.name }));
          nextRepairs = getDemoRepairs().map((repair) => ({ id: repair.id, name: repair.title }));
        }
      } catch (loadLinksError) {
        errors.push(loadLinksError instanceof Error ? loadLinksError.message : 'Failed to load link options.');
      }

      if (!isMounted) {
        return;
      }

      setIssueContext(nextIssueContext);
      setTrendContext(nextTrendContext);
      setDataMode(nextIssueContext.mode);
      setHasProperty(nextIssueContext.mode === 'demo' || Boolean(nextIssueContext.property));
      setIssues(nextIssues);
      setTrendFlags(nextTrendFlags);
      setRooms(nextRooms);
      setAssets(nextAssets);
      setUtilities(nextUtilities);
      setRepairs(nextRepairs);
      setLoadError(errors.join(' '));
      setLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const openIssueCount = useMemo(
    () => issues.filter((issue) => issue.status !== 'resolved' && issue.status !== 'dismissed').length,
    [issues]
  );

  const highPriorityIssueCount = useMemo(
    () =>
      issues.filter(
        (issue) =>
          (issue.severity === 'high' || issue.severity === 'urgent') &&
          issue.status !== 'resolved' &&
          issue.status !== 'dismissed'
      ).length,
    [issues]
  );

  const activeTrendFlagCount = useMemo(
    () => trendFlags.filter((flag) => flag.status === 'active').length,
    [trendFlags]
  );

  const filteredIssues = useMemo(() => {
    const searchTerm = issueSearch.trim().toLowerCase();
    const severityRank = new Map(ISSUE_SEVERITIES.map((value, index) => [value, index]));
    const statusRank = new Map(ISSUE_STATUSES.map((value, index) => [value, index]));

    return issues
      .filter((issue) => {
        const haystack = [issue.title, issue.description, issue.notes].filter(Boolean).join(' ').toLowerCase();
        const matchesSearch = !searchTerm || haystack.includes(searchTerm);
        const matchesStatus = !issueStatusFilter || issue.status === issueStatusFilter;
        const matchesSeverity = !issueSeverityFilter || issue.severity === issueSeverityFilter;
        const matchesType = !issueTypeFilter || issue.issue_type === issueTypeFilter;
        const matchesLink =
          !issueLinkFilter ||
          (issueLinkFilter === 'room' && Boolean(issue.room_id)) ||
          (issueLinkFilter === 'asset' && Boolean(issue.asset_id)) ||
          (issueLinkFilter === 'utility' && Boolean(issue.utility_id)) ||
          (issueLinkFilter === 'repair' && Boolean(issue.repair_id));

        return matchesSearch && matchesStatus && matchesSeverity && matchesType && matchesLink;
      })
      .slice()
      .sort((a, b) => {
        if (issueSortBy === 'severity') {
          return (severityRank.get(b.severity) ?? 0) - (severityRank.get(a.severity) ?? 0);
        }

        if (issueSortBy === 'last_seen_date') {
          const aDate = a.last_seen_date ? new Date(a.last_seen_date).getTime() : 0;
          const bDate = b.last_seen_date ? new Date(b.last_seen_date).getTime() : 0;
          return bDate - aDate || a.title.localeCompare(b.title);
        }

        if (issueSortBy === 'status') {
          return (statusRank.get(a.status) ?? 0) - (statusRank.get(b.status) ?? 0);
        }

        const aDate = a.first_seen_date ? new Date(a.first_seen_date).getTime() : 0;
        const bDate = b.first_seen_date ? new Date(b.first_seen_date).getTime() : 0;
        return bDate - aDate || a.title.localeCompare(b.title);
      });
  }, [issues, issueSearch, issueStatusFilter, issueSeverityFilter, issueTypeFilter, issueLinkFilter, issueSortBy]);

  const filteredTrendFlags = useMemo(() => {
    const searchTerm = flagSearch.trim().toLowerCase();
    const severityRank = new Map(ISSUE_SEVERITIES.map((value, index) => [value, index]));
    const statusRank = new Map(TREND_FLAG_STATUSES.map((value, index) => [value, index]));

    return trendFlags
      .filter((flag) => {
        const haystack = [flag.title, flag.description].filter(Boolean).join(' ').toLowerCase();
        const matchesSearch = !searchTerm || haystack.includes(searchTerm);
        const matchesStatus = !flagStatusFilter || flag.status === flagStatusFilter;
        const matchesSeverity = !flagSeverityFilter || flag.severity === flagSeverityFilter;
        const matchesType = !flagTypeFilter || flag.flag_type === flagTypeFilter;
        const matchesLink =
          !flagLinkFilter ||
          (flagLinkFilter === 'room' && Boolean(flag.room_id)) ||
          (flagLinkFilter === 'asset' && Boolean(flag.asset_id)) ||
          (flagLinkFilter === 'utility' && Boolean(flag.utility_id)) ||
          (flagLinkFilter === 'issue' && Boolean(flag.issue_id));

        return matchesSearch && matchesStatus && matchesSeverity && matchesType && matchesLink;
      })
      .slice()
      .sort((a, b) => {
        if (flagSortBy === 'severity') {
          return (severityRank.get(b.severity) ?? 0) - (severityRank.get(a.severity) ?? 0);
        }

        if (flagSortBy === 'last_detected_at') {
          const aDate = a.last_detected_at ? new Date(a.last_detected_at).getTime() : 0;
          const bDate = b.last_detected_at ? new Date(b.last_detected_at).getTime() : 0;
          return bDate - aDate || a.title.localeCompare(b.title);
        }

        if (flagSortBy === 'status') {
          return (statusRank.get(a.status) ?? 0) - (statusRank.get(b.status) ?? 0);
        }

        return new Date(b.first_detected_at).getTime() - new Date(a.first_detected_at).getTime();
      });
  }, [trendFlags, flagSearch, flagStatusFilter, flagSeverityFilter, flagTypeFilter, flagLinkFilter, flagSortBy]);

  const resetIssueForm = () => {
    setTitle('');
    setIssueType('general');
    setDescription('');
    setStatus('open');
    setSeverity('medium');
    setFirstSeenDate(new Date().toISOString().slice(0, 10));
    setLastSeenDate('');
    setResolvedDate('');
    setNotes('');
    setRoomId('');
    setAssetId('');
    setUtilityId('');
    setRepairId('');
  };

  const resetTrendFlagForm = () => {
    setFlagTitle('');
    setFlagType('manual_flag');
    setFlagSeverity('medium');
    setFlagStatus('active');
    setDetectedFrom('manual');
    setFlagDescription('');
    setFlagRoomId('');
    setFlagAssetId('');
    setFlagUtilityId('');
    setFlagIssueId('');
  };

  const submitIssue = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (!issueContext) {
      setFormError('Issue data is still loading.');
      return;
    }

    if (!title.trim()) {
      setFormError('Issue title is required.');
      return;
    }

    setSavingIssue(true);

    try {
      const createdIssue = await createIssueForContext(issueContext, {
        title,
        description,
        issue_type: issueType,
        status,
        severity,
        first_seen_date: firstSeenDate || null,
        last_seen_date: lastSeenDate || null,
        resolved_date: resolvedDate || null,
        notes,
        room_id: roomId || null,
        asset_id: assetId || null,
        utility_id: utilityId || null,
        repair_id: repairId || null
      });

      setIssues((currentIssues) => [createdIssue, ...currentIssues]);
      resetIssueForm();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to save issue.');
    } finally {
      setSavingIssue(false);
    }
  };

  const submitTrendFlag = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (!trendContext) {
      setFormError('Trend flag data is still loading.');
      return;
    }

    if (!flagTitle.trim()) {
      setFormError('Trend flag title is required.');
      return;
    }

    setSavingTrendFlag(true);

    try {
      const createdFlag = await createTrendFlagForContext(trendContext, {
        title: flagTitle,
        description: flagDescription,
        flag_type: flagType,
        severity: flagSeverity,
        status: flagStatus,
        detected_from: detectedFrom,
        room_id: flagRoomId || null,
        asset_id: flagAssetId || null,
        utility_id: flagUtilityId || null,
        issue_id: flagIssueId || null
      });

      setTrendFlags((currentFlags) => [createdFlag, ...currentFlags]);
      resetTrendFlagForm();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to save trend flag.');
    } finally {
      setSavingTrendFlag(false);
    }
  };

  const changeIssueStatus = async (issueId: string, nextStatus: IssueStatus) => {
    if (!issueContext) {
      return;
    }

    setUpdatingId(issueId);
    setFormError('');

    try {
      const updatedIssue = await updateIssueStatusForContext(issueContext, issueId, nextStatus);
      if (updatedIssue) {
        setIssues((currentIssues) =>
          currentIssues.map((issue) => (issue.id === issueId ? updatedIssue : issue))
        );
      }
    } catch (statusError) {
      setFormError(statusError instanceof Error ? statusError.message : 'Failed to update issue status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const changeTrendFlagStatus = async (flagId: string, nextStatus: TrendFlagStatus) => {
    if (!trendContext) {
      return;
    }

    setUpdatingId(flagId);
    setFormError('');

    try {
      const updatedFlag = await updateTrendFlagStatusForContext(trendContext, flagId, nextStatus);
      if (updatedFlag) {
        setTrendFlags((currentFlags) =>
          currentFlags.map((flag) => (flag.id === flagId ? updatedFlag : flag))
        );
      }
    } catch (statusError) {
      setFormError(statusError instanceof Error ? statusError.message : 'Failed to update trend flag status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteIssue = async (issueId: string) => {
    if (!issueContext) {
      return;
    }

    setDeletingId(issueId);
    setFormError('');

    try {
      await deleteIssueForContext(issueContext, issueId);
      setIssues((currentIssues) => currentIssues.filter((issue) => issue.id !== issueId));
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : 'Failed to delete issue.');
    } finally {
      setDeletingId(null);
    }
  };

  const deleteTrendFlag = async (flagId: string) => {
    if (!trendContext) {
      return;
    }

    setDeletingId(flagId);
    setFormError('');

    try {
      await deleteTrendFlagForContext(trendContext, flagId);
      setTrendFlags((currentFlags) => currentFlags.filter((flag) => flag.id !== flagId));
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : 'Failed to delete trend flag.');
    } finally {
      setDeletingId(null);
    }
  };

  const renderLinkSelectors = (
    selectedRoomId: string,
    setSelectedRoomId: (value: string) => void,
    selectedAssetId: string,
    setSelectedAssetId: (value: string) => void,
    selectedUtilityId: string,
    setSelectedUtilityId: (value: string) => void
  ) => (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 600 }}>Room</span>
        <select value={selectedRoomId} onChange={(event) => setSelectedRoomId(event.target.value)} style={fieldStyle}>
          <option value="">Not linked</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>
      </label>

      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 600 }}>Asset</span>
        <select value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)} style={fieldStyle}>
          <option value="">Not linked</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>{asset.name}</option>
          ))}
        </select>
      </label>

      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 600 }}>Utility</span>
        <select value={selectedUtilityId} onChange={(event) => setSelectedUtilityId(event.target.value)} style={fieldStyle}>
          <option value="">Not linked</option>
          {utilities.map((utility) => (
            <option key={utility.id} value={utility.id}>{utility.name}</option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Issues"
        description="Track observed issues and trend flags across rooms, assets, utilities, and repairs."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <UtilityBadge label={`${openIssueCount} open issue${openIssueCount === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${highPriorityIssueCount} high or urgent`} />
            <UtilityBadge label={`${activeTrendFlagCount} active trend flag${activeTrendFlagCount === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${trendFlags.length} trend flag${trendFlags.length === 1 ? '' : 's'}`} />
          </div>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? '#065f46' : '#6b7280' }}>
            {dataMode === 'supabase'
              ? 'Signed-in mode: issues and trend flags are loaded from Supabase.'
              : 'Demo mode: issues and trend flags are stored in localStorage.'}
          </p>
          {loading ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#6b7280' }}>Loading issues and trend flags...</p>
          ) : null}
          {loadError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>{loadError}</p>
          ) : null}
          {dataMode === 'supabase' && !hasProperty ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#6b7280' }}>
              Create a property before adding Supabase issues or trend flags.
            </p>
          ) : null}
          {formError ? (
            <div style={{ marginTop: 12, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: 10 }}>
              {formError}
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Add issue</h2>
          <form onSubmit={submitIssue} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} style={fieldStyle} />
            </label>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Issue type</span>
                <select value={issueType} onChange={(event) => setIssueType(event.target.value as IssueType)} style={fieldStyle}>
                  {ISSUE_TYPES.map((type) => (
                    <option key={type} value={type}>{formatEnumLabel(type)}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as IssueStatus)} style={fieldStyle}>
                  {ISSUE_STATUSES.map((value) => (
                    <option key={value} value={value}>{formatEnumLabel(value)}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Severity</span>
                <select value={severity} onChange={(event) => setSeverity(event.target.value as IssueSeverity)} style={fieldStyle}>
                  {ISSUE_SEVERITIES.map((value) => (
                    <option key={value} value={value}>{formatEnumLabel(value)}</option>
                  ))}
                </select>
              </label>
            </div>

            {renderLinkSelectors(roomId, setRoomId, assetId, setAssetId, utilityId, setUtilityId)}

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Repair</span>
              <select value={repairId} onChange={(event) => setRepairId(event.target.value)} style={fieldStyle}>
                <option value="">Not linked</option>
                {repairs.map((repair) => (
                  <option key={repair.id} value={repair.id}>{repair.name}</option>
                ))}
              </select>
            </label>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>First seen</span>
                <input type="date" value={firstSeenDate} onChange={(event) => setFirstSeenDate(event.target.value)} style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Last seen</span>
                <input type="date" value={lastSeenDate} onChange={(event) => setLastSeenDate(event.target.value)} style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Resolved</span>
                <input type="date" value={resolvedDate} onChange={(event) => setResolvedDate(event.target.value)} style={fieldStyle} />
              </label>
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} style={{ ...fieldStyle, minHeight: 76 }} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Notes</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} style={{ ...fieldStyle, minHeight: 76 }} />
            </label>

            <div>
              <Button type="submit" disabled={savingIssue || (dataMode === 'supabase' && !hasProperty)}>
                {savingIssue ? 'Saving issue...' : 'Save issue'}
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Add trend flag</h2>
          <form onSubmit={submitTrendFlag} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Title</span>
              <input value={flagTitle} onChange={(event) => setFlagTitle(event.target.value)} style={fieldStyle} />
            </label>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Flag type</span>
                <select value={flagType} onChange={(event) => setFlagType(event.target.value as TrendFlagType)} style={fieldStyle}>
                  {TREND_FLAG_TYPES.map((type) => (
                    <option key={type} value={type}>{formatEnumLabel(type)}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Status</span>
                <select value={flagStatus} onChange={(event) => setFlagStatus(event.target.value as TrendFlagStatus)} style={fieldStyle}>
                  {TREND_FLAG_STATUSES.map((value) => (
                    <option key={value} value={value}>{formatEnumLabel(value)}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Severity</span>
                <select value={flagSeverity} onChange={(event) => setFlagSeverity(event.target.value as TrendFlagSeverity)} style={fieldStyle}>
                  {ISSUE_SEVERITIES.map((value) => (
                    <option key={value} value={value}>{formatEnumLabel(value)}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Detected from</span>
                <select value={detectedFrom} onChange={(event) => setDetectedFrom(event.target.value as TrendFlagDetectedFrom)} style={fieldStyle}>
                  {TREND_FLAG_DETECTED_FROM.map((value) => (
                    <option key={value} value={value}>{formatEnumLabel(value)}</option>
                  ))}
                </select>
              </label>
            </div>

            {renderLinkSelectors(flagRoomId, setFlagRoomId, flagAssetId, setFlagAssetId, flagUtilityId, setFlagUtilityId)}

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Issue</span>
              <select value={flagIssueId} onChange={(event) => setFlagIssueId(event.target.value)} style={fieldStyle}>
                <option value="">Not linked</option>
                {issues.map((issue) => (
                  <option key={issue.id} value={issue.id}>{issue.title}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Description</span>
              <textarea value={flagDescription} onChange={(event) => setFlagDescription(event.target.value)} style={{ ...fieldStyle, minHeight: 76 }} />
            </label>

            <div>
              <Button type="submit" disabled={savingTrendFlag || (dataMode === 'supabase' && !hasProperty)}>
                {savingTrendFlag ? 'Saving trend flag...' : 'Save trend flag'}
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Find issues</h2>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Search</span>
              <input value={issueSearch} onChange={(event) => setIssueSearch(event.target.value)} placeholder="Title, description, notes" style={fieldStyle} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Status</span>
              <select value={issueStatusFilter} onChange={(event) => setIssueStatusFilter(event.target.value)} style={fieldStyle}>
                <option value="">All statuses</option>
                {ISSUE_STATUSES.map((value) => (
                  <option key={value} value={value}>{formatEnumLabel(value)}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Severity</span>
              <select value={issueSeverityFilter} onChange={(event) => setIssueSeverityFilter(event.target.value)} style={fieldStyle}>
                <option value="">All severities</option>
                {ISSUE_SEVERITIES.map((value) => (
                  <option key={value} value={value}>{formatEnumLabel(value)}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Issue type</span>
              <select value={issueTypeFilter} onChange={(event) => setIssueTypeFilter(event.target.value)} style={fieldStyle}>
                <option value="">All issue types</option>
                {ISSUE_TYPES.map((value) => (
                  <option key={value} value={value}>{formatEnumLabel(value)}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Linked to</span>
              <select value={issueLinkFilter} onChange={(event) => setIssueLinkFilter(event.target.value)} style={fieldStyle}>
                <option value="">Any item</option>
                <option value="room">Room</option>
                <option value="asset">Asset</option>
                <option value="utility">Utility</option>
                <option value="repair">Repair</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Sort</span>
              <select value={issueSortBy} onChange={(event) => setIssueSortBy(event.target.value as 'severity' | 'first_seen_date' | 'last_seen_date' | 'status')} style={fieldStyle}>
                <option value="first_seen_date">First seen date</option>
                <option value="last_seen_date">Last seen date</option>
                <option value="severity">Severity</option>
                <option value="status">Status</option>
              </select>
            </label>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Find trend flags</h2>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Search</span>
              <input value={flagSearch} onChange={(event) => setFlagSearch(event.target.value)} placeholder="Title or description" style={fieldStyle} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Status</span>
              <select value={flagStatusFilter} onChange={(event) => setFlagStatusFilter(event.target.value)} style={fieldStyle}>
                <option value="">All statuses</option>
                {TREND_FLAG_STATUSES.map((value) => (
                  <option key={value} value={value}>{formatEnumLabel(value)}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Severity</span>
              <select value={flagSeverityFilter} onChange={(event) => setFlagSeverityFilter(event.target.value)} style={fieldStyle}>
                <option value="">All severities</option>
                {ISSUE_SEVERITIES.map((value) => (
                  <option key={value} value={value}>{formatEnumLabel(value)}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Flag type</span>
              <select value={flagTypeFilter} onChange={(event) => setFlagTypeFilter(event.target.value)} style={fieldStyle}>
                <option value="">All flag types</option>
                {TREND_FLAG_TYPES.map((value) => (
                  <option key={value} value={value}>{formatEnumLabel(value)}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Linked to</span>
              <select value={flagLinkFilter} onChange={(event) => setFlagLinkFilter(event.target.value)} style={fieldStyle}>
                <option value="">Any item</option>
                <option value="room">Room</option>
                <option value="asset">Asset</option>
                <option value="utility">Utility</option>
                <option value="issue">Issue</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Sort</span>
              <select value={flagSortBy} onChange={(event) => setFlagSortBy(event.target.value as 'severity' | 'first_detected_at' | 'last_detected_at' | 'status')} style={fieldStyle}>
                <option value="first_detected_at">First detected date</option>
                <option value="last_detected_at">Last detected date</option>
                <option value="severity">Severity</option>
                <option value="status">Status</option>
              </select>
            </label>
          </div>
        </Card>

        {!loading && issues.length === 0 && trendFlags.length === 0 ? (
          <EmptyState title="No issues or trend flags yet" description="Add your first issue or trend flag to start tracking home health." />
        ) : null}

        {issues.length > 0 ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Issues ({filteredIssues.length})</h2>
            {filteredIssues.length === 0 ? (
              <p style={{ color: '#6b7280', margin: 0 }}>No issues match the current filters.</p>
            ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {filteredIssues.map((issue) => (
                <div key={issue.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
                    <div>
                      <h3 style={{ margin: '0 0 8px 0' }}>{issue.title}</h3>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <UtilityBadge label={formatEnumLabel(issue.issue_type)} />
                        <UtilityBadge label={formatEnumLabel(issue.severity)} />
                        {issue.room_id && <UtilityBadge label={`Room: ${nameFromId(rooms, issue.room_id) || 'Unknown'}`} />}
                        {issue.asset_id && <UtilityBadge label={`Asset: ${nameFromId(assets, issue.asset_id) || 'Unknown'}`} />}
                        {issue.utility_id && <UtilityBadge label={`Utility: ${nameFromId(utilities, issue.utility_id) || 'Unknown'}`} />}
                        {issue.repair_id && <UtilityBadge label={`Repair: ${nameFromId(repairs, issue.repair_id) || 'Unknown'}`} />}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '0.9rem', display: 'grid', gap: 4 }}>
                        <div><strong>First seen:</strong> {issue.first_seen_date || 'Not set'}</div>
                        {issue.last_seen_date && <div><strong>Last seen:</strong> {issue.last_seen_date}</div>}
                        {issue.resolved_date && <div><strong>Resolved:</strong> {issue.resolved_date}</div>}
                        {issue.description && <div><strong>Description:</strong> {issue.description}</div>}
                        {issue.notes && <div><strong>Notes:</strong> {issue.notes}</div>}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 8, minWidth: 150 }}>
                      <Link href={`/issues/${issue.id}`}>
                        <Button type="button">View</Button>
                      </Link>
                      <select
                        value={issue.status}
                        onChange={(event) => changeIssueStatus(issue.id, event.target.value as IssueStatus)}
                        disabled={updatingId === issue.id}
                        style={fieldStyle}
                      >
                        {ISSUE_STATUSES.map((value) => (
                          <option key={value} value={value}>{formatEnumLabel(value)}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => deleteIssue(issue.id)}
                        disabled={deletingId === issue.id}
                        style={{
                          ...destructiveButtonStyle,
                          cursor: deletingId === issue.id ? 'not-allowed' : 'pointer',
                          opacity: deletingId === issue.id ? 0.7 : 1
                        }}
                      >
                        {deletingId === issue.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </Card>
        ) : null}

        {trendFlags.length > 0 ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Trend flags ({filteredTrendFlags.length})</h2>
            {filteredTrendFlags.length === 0 ? (
              <p style={{ color: '#6b7280', margin: 0 }}>No trend flags match the current filters.</p>
            ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {filteredTrendFlags.map((flag) => (
                <div key={flag.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
                    <div>
                      <h3 style={{ margin: '0 0 8px 0' }}>{flag.title}</h3>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <UtilityBadge label={formatEnumLabel(flag.flag_type)} />
                        <UtilityBadge label={formatEnumLabel(flag.severity)} />
                        <UtilityBadge label={formatEnumLabel(flag.detected_from)} />
                        {flag.room_id && <UtilityBadge label={`Room: ${nameFromId(rooms, flag.room_id) || 'Unknown'}`} />}
                        {flag.asset_id && <UtilityBadge label={`Asset: ${nameFromId(assets, flag.asset_id) || 'Unknown'}`} />}
                        {flag.utility_id && <UtilityBadge label={`Utility: ${nameFromId(utilities, flag.utility_id) || 'Unknown'}`} />}
                        {flag.issue_id && <UtilityBadge label={`Issue: ${issueTitleFromId(issues, flag.issue_id) || 'Unknown'}`} />}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '0.9rem', display: 'grid', gap: 4 }}>
                        <div><strong>First detected:</strong> {flag.first_detected_at.slice(0, 10)}</div>
                        {flag.last_detected_at && <div><strong>Last detected:</strong> {flag.last_detected_at.slice(0, 10)}</div>}
                        {flag.resolved_at && <div><strong>Resolved:</strong> {flag.resolved_at.slice(0, 10)}</div>}
                        {flag.description && <div><strong>Description:</strong> {flag.description}</div>}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 8, minWidth: 150 }}>
                      <select
                        value={flag.status}
                        onChange={(event) => changeTrendFlagStatus(flag.id, event.target.value as TrendFlagStatus)}
                        disabled={updatingId === flag.id}
                        style={fieldStyle}
                      >
                        {TREND_FLAG_STATUSES.map((value) => (
                          <option key={value} value={value}>{formatEnumLabel(value)}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => deleteTrendFlag(flag.id)}
                        disabled={deletingId === flag.id}
                        style={{
                          ...destructiveButtonStyle,
                          cursor: deletingId === flag.id ? 'not-allowed' : 'pointer',
                          opacity: deletingId === flag.id ? 0.7 : 1
                        }}
                      >
                        {deletingId === flag.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </Card>
        ) : null}
      </div>
    </>
  );
}
