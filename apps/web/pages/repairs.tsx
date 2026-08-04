import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import {
  formatEnumLabel,
  REPAIR_PRIORITIES,
  REPAIR_STATUSES,
  REPAIR_TYPES,
  SERVICE_TYPES,
  toLocalDateString
} from '@home-folder/shared';
import { Button, Card, EmptyState, PageHeader, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { RoomLocationSelect, roomSelectionValue } from '../components/RoomLocationSelect';
import { ViewOnlyNotice } from '../components/ViewOnlyNotice';
import { usePropertyAccess } from '../lib/access';
import { getAssetsForProperty, getDemoAssets, type AssetRow } from '../lib/assets';
import { getDemoRooms } from '../lib/demoStorage';
import { getIssueDataContext, getIssuesForContext, type IssueRow } from '../lib/issues';
import {
  isLocationPresetValue,
  resolveLocationRoomId,
  rollbackCreatedLocation
} from '../lib/locationPresets';
import {
  createRepairForContext,
  deleteRepairForContext,
  getRepairDataContext,
  getRepairsForContext,
  updateRepairStatusForContext,
  type RepairDataContext,
  type RepairRow,
  type RepairStatus
} from '../lib/repairs';
import {
  createServiceRecordForContext,
  deleteServiceRecordForContext,
  getServiceRecordDataContext,
  getServiceRecordsForContext,
  updateServiceRecordForContext,
  type ServiceRecordDataContext,
  type ServiceRecordRow
} from '../lib/serviceRecords';
import { getRoomsForProperty } from '../lib/rooms';
import { formatRoomLocation } from '../lib/roomLabels';
import { getTrendFlagDataContext, getTrendFlagsForContext, type TrendFlagRow } from '../lib/trendFlags';
import { getDemoUtilities, getUtilitiesForProperty, type UtilityRow } from '../lib/utilities';

type LinkOption = {
  id: string;
  name: string;
};

type RoomOption = LinkOption & {
  room_type?: string | null;
  floor_name?: string | null;
};

/** The editable shape of a service history item, as the inline form holds it. */
type ServiceRecordDraft = {
  service_title: string;
  service_type: (typeof SERVICE_TYPES)[number];
  service_date: string;
  provider_name: string;
  provider_phone: string;
  provider_email: string;
  cost: string;
  summary: string;
  notes: string;
  next_service_date: string;
  room_choice: string;
  room_custom_name: string;
  asset_id: string;
  utility_id: string;
};

const EMPTY_SERVICE_RECORD_DRAFT: ServiceRecordDraft = {
  service_title: '',
  service_type: 'maintenance',
  service_date: '',
  provider_name: '',
  provider_phone: '',
  provider_email: '',
  cost: '',
  summary: '',
  notes: '',
  next_service_date: '',
  room_choice: '',
  room_custom_name: '',
  asset_id: '',
  utility_id: ''
};

function serviceRecordToDraft(record: ServiceRecordRow): ServiceRecordDraft {
  return {
    service_title: record.service_title,
    service_type: record.service_type,
    service_date: record.service_date || '',
    provider_name: record.provider_name || '',
    provider_phone: record.provider_phone || '',
    provider_email: record.provider_email || '',
    cost: record.cost === null ? '' : String(record.cost),
    summary: record.summary || '',
    notes: record.notes || '',
    next_service_date: record.next_service_date || '',
    room_choice: record.room_id || '',
    room_custom_name: '',
    asset_id: record.asset_id || '',
    utility_id: record.utility_id || ''
  };
}

const fieldStyle = {
  padding: 10,
  borderRadius: 4,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)'
};

const labelStyle = { display: 'grid', gap: 6 } as const;

const fieldRowStyle = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
} as const;

function moneyValue(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nameFromId(list: LinkOption[], id?: string | null) {
  if (!id) {
    return null;
  }

  return list.find((item) => item.id === id)?.name || 'Unknown';
}

function roomNameFromId(list: RoomOption[], id?: string | null) {
  if (!id) {
    return null;
  }

  const room = list.find((item) => item.id === id);
  return room ? formatRoomLocation(room) : 'Unknown';
}

export default function RepairsPage() {
  const [repairContext, setRepairContext] = useState<RepairDataContext | null>(null);
  const [serviceContext, setServiceContext] = useState<ServiceRecordDataContext | null>(null);
  const [dataMode, setDataMode] = useState<'demo' | 'supabase'>('demo');
  const access = usePropertyAccess();
  const [hasProperty, setHasProperty] = useState(false);
  const [repairs, setRepairs] = useState<RepairRow[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [trendFlags, setTrendFlags] = useState<TrendFlagRow[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [assets, setAssets] = useState<LinkOption[]>([]);
  const [utilities, setUtilities] = useState<LinkOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [savingRepair, setSavingRepair] = useState(false);
  const [savingServiceRecord, setSavingServiceRecord] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordDraft, setRecordDraft] = useState<ServiceRecordDraft>(EMPTY_SERVICE_RECORD_DRAFT);
  const [savingRecordEdits, setSavingRecordEdits] = useState(false);
  const [recordNotice, setRecordNotice] = useState('');
  const [repairStatusFilter, setRepairStatusFilter] = useState('');
  const [repairPriorityFilter, setRepairPriorityFilter] = useState('');
  const [repairTypeFilter, setRepairTypeFilter] = useState('');
  const [repairLinkFilter, setRepairLinkFilter] = useState('');
  const [repairSearch, setRepairSearch] = useState('');
  const [repairSortBy, setRepairSortBy] = useState<'reported_date' | 'completed_date' | 'priority' | 'status'>('reported_date');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [serviceLinkFilter, setServiceLinkFilter] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceSortBy, setServiceSortBy] = useState<'service_date' | 'next_service_date'>('service_date');

  const [repairTitle, setRepairTitle] = useState('');
  const [repairDescription, setRepairDescription] = useState('');
  const [repairType, setRepairType] = useState<(typeof REPAIR_TYPES)[number]>('general');
  const [repairStatus, setRepairStatus] = useState<(typeof REPAIR_STATUSES)[number]>('open');
  const [repairPriority, setRepairPriority] = useState<(typeof REPAIR_PRIORITIES)[number]>('normal');
  const [reportedDate, setReportedDate] = useState(toLocalDateString());
  const [completedDate, setCompletedDate] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledWindow, setScheduledWindow] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [contractorPhone, setContractorPhone] = useState('');
  const [contractorEmail, setContractorEmail] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [repairNotes, setRepairNotes] = useState('');
  const [repairRoomId, setRepairRoomId] = useState('');
  const [repairAssetId, setRepairAssetId] = useState('');
  const [repairUtilityId, setRepairUtilityId] = useState('');

  const [serviceTitle, setServiceTitle] = useState('');
  const [serviceType, setServiceType] = useState<(typeof SERVICE_TYPES)[number]>('maintenance');
  const [serviceDate, setServiceDate] = useState(toLocalDateString());
  const [providerName, setProviderName] = useState('');
  const [providerPhone, setProviderPhone] = useState('');
  const [providerEmail, setProviderEmail] = useState('');
  const [serviceCost, setServiceCost] = useState('');
  const [serviceSummary, setServiceSummary] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');
  const [nextServiceDate, setNextServiceDate] = useState('');
  const [serviceRoomId, setServiceRoomId] = useState('');
  const [serviceAssetId, setServiceAssetId] = useState('');
  const [serviceUtilityId, setServiceUtilityId] = useState('');

  const router = useRouter();

  // "Report a problem" links (e.g. from a utility page) prefill the new-repair
  // form with the thing being reported.
  //
  // Waits for the option lists to load, then only applies ids that actually
  // exist. A stale or hand-edited link previously wrote its id straight into
  // state: the <select> rendered blank (selectedIndex -1) while still holding
  // the value, and submitting produced a raw foreign-key violation.
  useEffect(() => {
    if (!router.isReady || loading) {
      return;
    }

    const queryValue = (value: string | string[] | undefined) =>
      Array.isArray(value) ? value[0] : value;

    const prefillUtilityId = queryValue(router.query.utilityId);
    const prefillRoomId = queryValue(router.query.roomId);
    const prefillTitle = queryValue(router.query.title);

    const stale: string[] = [];

    if (prefillUtilityId) {
      if (utilities.some((option) => option.id === prefillUtilityId)) {
        setRepairUtilityId(prefillUtilityId);
      } else {
        stale.push('utility');
      }
    }

    if (prefillRoomId) {
      if (rooms.some((option) => option.id === prefillRoomId)) {
        setRepairRoomId(prefillRoomId);
      } else {
        stale.push('room');
      }
    }

    if (prefillTitle) {
      // Strip control characters and cap the length — this string ends up as
      // the heading of a printed sheet and the subject of an email.
      // eslint-disable-next-line no-control-regex
      setRepairTitle(prefillTitle.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 200));
    }

    if (stale.length > 0) {
      setFormError(
        `That ${stale.join(' and ')} no longer exists, so it was not pre-selected. Pick another below.`
      );
    }
  }, [
    router.isReady,
    router.query.utilityId,
    router.query.roomId,
    router.query.title,
    loading,
    rooms,
    utilities
  ]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setLoadError('');

      const errors: string[] = [];
      const [nextRepairContext, nextServiceContext, issueContext, trendFlagContext] = await Promise.all([
        getRepairDataContext(),
        getServiceRecordDataContext(),
        getIssueDataContext(),
        getTrendFlagDataContext()
      ]);
      let nextRepairs: RepairRow[] = [];
      let nextServiceRecords: ServiceRecordRow[] = [];
      let nextIssues: IssueRow[] = [];
      let nextTrendFlags: TrendFlagRow[] = [];
      let nextRooms: RoomOption[] = [];
      let nextAssets: LinkOption[] = [];
      let nextUtilities: LinkOption[] = [];

      try {
        nextRepairs = await getRepairsForContext(nextRepairContext);
      } catch (loadRepairsError) {
        errors.push(loadRepairsError instanceof Error ? loadRepairsError.message : 'Failed to load repairs.');
      }

      try {
        nextServiceRecords = await getServiceRecordsForContext(nextServiceContext);
      } catch (loadRecordsError) {
        errors.push(loadRecordsError instanceof Error ? loadRecordsError.message : 'Failed to load service history.');
      }

      try {
        nextIssues = await getIssuesForContext(issueContext);
      } catch (loadIssuesError) {
        errors.push(loadIssuesError instanceof Error ? loadIssuesError.message : 'Failed to load issues.');
      }

      try {
        nextTrendFlags = await getTrendFlagsForContext(trendFlagContext);
      } catch (loadFlagsError) {
        errors.push(loadFlagsError instanceof Error ? loadFlagsError.message : 'Failed to load trends.');
      }

      try {
        if (nextRepairContext.mode === 'supabase' && nextRepairContext.property) {
          const [roomRows, assetRows, utilityRows] = await Promise.all([
            getRoomsForProperty(nextRepairContext.property.id),
            getAssetsForProperty(nextRepairContext.property.id),
            getUtilitiesForProperty(nextRepairContext.property.id)
          ]);

          nextRooms = roomRows.map((room) => ({
            id: room.id,
            name: room.name,
            room_type: room.room_type,
            floor_name: room.floor_name
          }));
          nextAssets = assetRows.map((asset: AssetRow) => ({ id: asset.id, name: asset.name }));
          nextUtilities = utilityRows.map((utility: UtilityRow) => ({ id: utility.id, name: utility.name }));
        } else {
          nextRooms = getDemoRooms().map((room) => ({
            id: room.id,
            name: room.name,
            room_type: room.room_type,
            floor_name: room.floor_name
          }));
          nextAssets = getDemoAssets().map((asset) => ({ id: asset.id, name: asset.name }));
          nextUtilities = getDemoUtilities().map((utility) => ({ id: utility.id, name: utility.name }));
        }
      } catch (loadLinksError) {
        errors.push(loadLinksError instanceof Error ? loadLinksError.message : 'Failed to load link options.');
      }

      if (!isMounted) {
        return;
      }

      setRepairContext(nextRepairContext);
      setServiceContext(nextServiceContext);
      setDataMode(nextRepairContext.mode);
      setHasProperty(nextRepairContext.mode === 'demo' || Boolean(nextRepairContext.property));
      setRepairs(nextRepairs);
      setServiceRecords(nextServiceRecords);
      setRooms(nextRooms);
      setAssets(nextAssets);
      setUtilities(nextUtilities);
      setIssues(nextIssues);
      setTrendFlags(nextTrendFlags);
      setLoadError(errors.join(' '));
      setLoading(false);
    }

    load().catch((err) => {
      if (isMounted) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load data.');
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const openRepairCount = useMemo(
    () => repairs.filter((repair) => repair.status === 'open').length,
    [repairs]
  );
  const openIssueCount = useMemo(
    () => issues.filter((issue) => issue.status !== 'resolved' && issue.status !== 'dismissed').length,
    [issues]
  );
  const activeTrendFlagCount = useMemo(
    () => trendFlags.filter((flag) => flag.status === 'active').length,
    [trendFlags]
  );

  const getIssueCountForRepair = (repairId: string) =>
    issues.filter(
      (issue) =>
        issue.repair_id === repairId &&
        issue.status !== 'resolved' &&
        issue.status !== 'dismissed'
    ).length;

  const filteredRepairs = useMemo(() => {
    const searchTerm = repairSearch.trim().toLowerCase();
    const priorityRank = new Map(REPAIR_PRIORITIES.map((value, index) => [value, index]));
    const statusRank = new Map(REPAIR_STATUSES.map((value, index) => [value, index]));

    return repairs
      .filter((repair) => {
        const haystack = [
          repair.title,
          repair.contractor_name,
          repair.notes,
          repair.description
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const matchesSearch = !searchTerm || haystack.includes(searchTerm);
        const matchesStatus = !repairStatusFilter || repair.status === repairStatusFilter;
        const matchesPriority = !repairPriorityFilter || repair.priority === repairPriorityFilter;
        const matchesType = !repairTypeFilter || repair.repair_type === repairTypeFilter;
        const matchesLink =
          !repairLinkFilter ||
          (repairLinkFilter === 'room' && Boolean(repair.room_id)) ||
          (repairLinkFilter === 'asset' && Boolean(repair.asset_id)) ||
          (repairLinkFilter === 'utility' && Boolean(repair.utility_id));

        return matchesSearch && matchesStatus && matchesPriority && matchesType && matchesLink;
      })
      .slice()
      .sort((a, b) => {
        if (repairSortBy === 'completed_date') {
          const aDate = a.completed_date ? new Date(a.completed_date).getTime() : 0;
          const bDate = b.completed_date ? new Date(b.completed_date).getTime() : 0;
          return bDate - aDate || a.title.localeCompare(b.title);
        }

        if (repairSortBy === 'priority') {
          return (priorityRank.get(b.priority) ?? 0) - (priorityRank.get(a.priority) ?? 0);
        }

        if (repairSortBy === 'status') {
          return (statusRank.get(a.status) ?? 0) - (statusRank.get(b.status) ?? 0);
        }

        const aDate = a.reported_date ? new Date(a.reported_date).getTime() : 0;
        const bDate = b.reported_date ? new Date(b.reported_date).getTime() : 0;
        return bDate - aDate || a.title.localeCompare(b.title);
      });
  }, [repairs, repairSearch, repairStatusFilter, repairPriorityFilter, repairTypeFilter, repairLinkFilter, repairSortBy]);

  const filteredServiceRecords = useMemo(() => {
    const searchTerm = serviceSearch.trim().toLowerCase();

    return serviceRecords
      .filter((record) => {
        const haystack = [
          record.service_title,
          record.provider_name,
          record.summary,
          record.notes
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const matchesSearch = !searchTerm || haystack.includes(searchTerm);
        const matchesType = !serviceTypeFilter || record.service_type === serviceTypeFilter;
        const matchesLink =
          !serviceLinkFilter ||
          (serviceLinkFilter === 'room' && Boolean(record.room_id)) ||
          (serviceLinkFilter === 'asset' && Boolean(record.asset_id)) ||
          (serviceLinkFilter === 'utility' && Boolean(record.utility_id));

        return matchesSearch && matchesType && matchesLink;
      })
      .slice()
      .sort((a, b) => {
        if (serviceSortBy === 'next_service_date') {
          const aDate = a.next_service_date ? new Date(a.next_service_date).getTime() : Number.POSITIVE_INFINITY;
          const bDate = b.next_service_date ? new Date(b.next_service_date).getTime() : Number.POSITIVE_INFINITY;
          return aDate - bDate || a.service_title.localeCompare(b.service_title);
        }

        return new Date(b.service_date).getTime() - new Date(a.service_date).getTime();
      });
  }, [serviceRecords, serviceSearch, serviceTypeFilter, serviceLinkFilter, serviceSortBy]);

  const resetRepairForm = () => {
    setRepairTitle('');
    setRepairDescription('');
    setRepairType('general');
    setRepairStatus('open');
    setRepairPriority('normal');
    setReportedDate(toLocalDateString());
    setCompletedDate('');
    setScheduledDate('');
    setScheduledWindow('');
    setContractorName('');
    setContractorPhone('');
    setContractorEmail('');
    setEstimatedCost('');
    setActualCost('');
    setRepairNotes('');
    setRepairRoomId('');
    setRepairAssetId('');
    setRepairUtilityId('');
  };

  const resetServiceRecordForm = () => {
    setServiceTitle('');
    setServiceType('maintenance');
    setServiceDate(toLocalDateString());
    setProviderName('');
    setProviderPhone('');
    setProviderEmail('');
    setServiceCost('');
    setServiceSummary('');
    setServiceNotes('');
    setNextServiceDate('');
    setServiceRoomId('');
    setServiceAssetId('');
    setServiceUtilityId('');
  };

  const submitRepair = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (!repairContext) {
      setFormError('Repair data is still loading.');
      return;
    }

    if (!repairTitle.trim()) {
      setFormError('Repair title is required.');
      return;
    }

    const parsedEstimatedCost = moneyValue(estimatedCost);
    const parsedActualCost = moneyValue(actualCost);

    if ((estimatedCost && parsedEstimatedCost === null) || (actualCost && parsedActualCost === null)) {
      setFormError('Repair costs must be valid numbers.');
      return;
    }

    setSavingRepair(true);

    try {
      const createdRepair = await createRepairForContext(repairContext, {
        title: repairTitle,
        description: repairDescription,
        repair_type: repairType,
        status: repairStatus,
        priority: repairPriority,
        reported_date: reportedDate || null,
        completed_date: completedDate || null,
        scheduled_date: scheduledDate || null,
        scheduled_window: scheduledWindow,
        contractor_name: contractorName,
        contractor_phone: contractorPhone,
        contractor_email: contractorEmail,
        estimated_cost: parsedEstimatedCost,
        actual_cost: parsedActualCost,
        notes: repairNotes,
        room_id: repairRoomId || null,
        asset_id: repairAssetId || null,
        utility_id: repairUtilityId || null
      });

      setRepairs((currentRepairs) => [createdRepair, ...currentRepairs]);
      resetRepairForm();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to save repair.');
    } finally {
      setSavingRepair(false);
    }
  };

  const submitServiceRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (!serviceContext) {
      setFormError('Service record data is still loading.');
      return;
    }

    if (!serviceTitle.trim()) {
      setFormError('Service title is required.');
      return;
    }

    const parsedServiceCost = moneyValue(serviceCost);

    if (serviceCost && parsedServiceCost === null) {
      setFormError('Service cost must be a valid number.');
      return;
    }

    setSavingServiceRecord(true);

    try {
      const createdRecord = await createServiceRecordForContext(serviceContext, {
        service_title: serviceTitle,
        service_type: serviceType,
        service_date: serviceDate || null,
        provider_name: providerName,
        provider_phone: providerPhone,
        provider_email: providerEmail,
        cost: parsedServiceCost,
        summary: serviceSummary,
        notes: serviceNotes,
        next_service_date: nextServiceDate || null,
        room_id: serviceRoomId || null,
        asset_id: serviceAssetId || null,
        utility_id: serviceUtilityId || null
      });

      setServiceRecords((currentRecords) => [createdRecord, ...currentRecords]);
      resetServiceRecordForm();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to save service history item.');
    } finally {
      setSavingServiceRecord(false);
    }
  };

  const changeRepairStatus = async (repairId: string, status: RepairStatus) => {
    if (!repairContext) {
      return;
    }

    setUpdatingStatusId(repairId);
    setFormError('');

    try {
      const updatedRepair = await updateRepairStatusForContext(repairContext, repairId, status);
      if (updatedRepair) {
        setRepairs((currentRepairs) =>
          currentRepairs.map((repair) => (repair.id === repairId ? updatedRepair : repair))
        );
      }
    } catch (statusError) {
      setFormError(statusError instanceof Error ? statusError.message : 'Failed to update repair status.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const deleteRepair = async (repairId: string) => {
    if (!repairContext) {
      return;
    }

    if (!window.confirm('Delete this repair?')) {
      return;
    }

    setDeletingId(repairId);
    setFormError('');

    try {
      await deleteRepairForContext(repairContext, repairId);
      setRepairs((currentRepairs) => currentRepairs.filter((repair) => repair.id !== repairId));
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : 'Failed to delete repair.');
    } finally {
      setDeletingId(null);
    }
  };

  const startEditingRecord = (record: ServiceRecordRow) => {
    setEditingRecordId(record.id);
    setRecordDraft(serviceRecordToDraft(record));
    setFormError('');
    setRecordNotice('');
  };

  const cancelRecordEdits = () => {
    setEditingRecordId(null);
    setRecordDraft(EMPTY_SERVICE_RECORD_DRAFT);
    setFormError('');
  };

  const saveRecordEdits = async (recordId: string) => {
    if (!serviceContext) {
      setFormError('Service record data is still loading.');
      return;
    }

    setRecordNotice('');

    if (!recordDraft.service_title.trim()) {
      setFormError('A service history item needs a title.');
      return;
    }

    const parsedCost = moneyValue(recordDraft.cost);

    if (recordDraft.cost && parsedCost === null) {
      setFormError('Service cost must be a valid number.');
      return;
    }

    const roomValue = roomSelectionValue(recordDraft.room_choice, recordDraft.room_custom_name);

    if (roomValue === null) {
      setFormError('Give the new room a name, or pick one from the list.');
      return;
    }

    setSavingRecordEdits(true);
    setFormError('');

    const resolutionContext =
      serviceContext.mode === 'supabase' && serviceContext.property
        ? ({ mode: 'supabase', propertyId: serviceContext.property.id } as const)
        : ({ mode: 'demo' } as const);

    let createdRoomId: string | null = null;

    try {
      const wasPreset = isLocationPresetValue(roomValue);
      const resolved = await resolveLocationRoomId(roomValue, resolutionContext);
      createdRoomId = resolved.createdRoomId;

      const updatedRecord = await updateServiceRecordForContext(serviceContext, recordId, {
        service_title: recordDraft.service_title,
        service_type: recordDraft.service_type,
        service_date: recordDraft.service_date || null,
        provider_name: recordDraft.provider_name,
        provider_phone: recordDraft.provider_phone,
        provider_email: recordDraft.provider_email,
        cost: parsedCost,
        summary: recordDraft.summary,
        notes: recordDraft.notes,
        next_service_date: recordDraft.next_service_date || null,
        room_id: resolved.roomId,
        asset_id: recordDraft.asset_id || null,
        utility_id: recordDraft.utility_id || null
      });

      if (updatedRecord) {
        setServiceRecords((currentRecords) =>
          currentRecords.map((record) => (record.id === recordId ? updatedRecord : record))
        );
      }

      if (wasPreset) {
        const refreshedRooms =
          serviceContext.mode === 'supabase' && serviceContext.property
            ? await getRoomsForProperty(serviceContext.property.id)
            : getDemoRooms();
        setRooms(
          refreshedRooms.map((room) => ({
            id: room.id,
            name: room.name,
            room_type: room.room_type,
            floor_name: room.floor_name
          }))
        );
      }

      setEditingRecordId(null);
      setRecordDraft(EMPTY_SERVICE_RECORD_DRAFT);
      setRecordNotice('Service history item updated.');
    } catch (saveError) {
      // A preset location creates its room before the record is written. If the
      // write fails, take the room back out rather than leaving an empty space
      // on the home map that nobody asked for.
      await rollbackCreatedLocation(createdRoomId, resolutionContext);
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to update service history item.');
    } finally {
      setSavingRecordEdits(false);
    }
  };

  const deleteServiceRecord = async (recordId: string) => {
    if (!serviceContext) {
      return;
    }

    if (!window.confirm('Delete this service history item?')) {
      return;
    }

    setDeletingId(recordId);
    setFormError('');

    try {
      await deleteServiceRecordForContext(serviceContext, recordId);
      setServiceRecords((currentRecords) => currentRecords.filter((record) => record.id !== recordId));
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : 'Failed to delete service history item.');
    } finally {
      setDeletingId(null);
    }
  };

  const renderLinkSelectors = (
    roomId: string,
    setRoomId: (value: string) => void,
    assetId: string,
    setAssetId: (value: string) => void,
    utilityId: string,
    setUtilityId: (value: string) => void
  ) => (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 600 }}>Room</span>
        <select value={roomId} onChange={(event) => setRoomId(event.target.value)} style={fieldStyle}>
          <option value="">Not linked</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>{formatRoomLocation(room)}</option>
          ))}
        </select>
      </label>

      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 600 }}>Asset</span>
        <select value={assetId} onChange={(event) => setAssetId(event.target.value)} style={fieldStyle}>
          <option value="">Not linked</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>{asset.name}</option>
          ))}
        </select>
      </label>

      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 600 }}>Utility</span>
        <select value={utilityId} onChange={(event) => setUtilityId(event.target.value)} style={fieldStyle}>
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
        title="Repairs & Service History"
        description="Open work, completed service, and the care history of the home."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <UtilityBadge label={`${openRepairCount} open repair${openRepairCount === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${repairs.length} repair${repairs.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${serviceRecords.length} service history item${serviceRecords.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${openIssueCount} open issue${openIssueCount === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${activeTrendFlagCount} active trend${activeTrendFlagCount === 1 ? '' : 's'}`} />
          </div>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? 'var(--status-good)' : 'var(--text-muted)' }}>
            {dataMode === 'supabase'
              ? 'Saved to your account.'
              : 'Demo data is stored only in this browser.'}
          </p>
          {loading ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--text-muted)' }}>Loading repairs and service history...</p>
          ) : null}
          {loadError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>{loadError}</p>
          ) : null}
          {dataMode === 'supabase' && !hasProperty ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--text-muted)' }}>
              Create a property before adding repairs or service history.
            </p>
          ) : null}
          {formError ? (
            <div
              role="alert"
              style={{ marginTop: 12, background: 'rgba(163,78,51,0.08)', color: 'var(--status-urgent)', border: '1px solid rgba(163,78,51,0.30)', borderRadius: 8, padding: 10 }}
            >
              {formError}
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Add repair</h2>
          {!access.loading && !access.canWrite ? (
            <ViewOnlyNotice role={access.role} action="add repairs" inline />
          ) : (
          <form onSubmit={submitRepair} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Title</span>
              <input value={repairTitle} onChange={(event) => setRepairTitle(event.target.value)} style={fieldStyle} />
            </label>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Repair type</span>
                <select value={repairType} onChange={(event) => setRepairType(event.target.value as (typeof REPAIR_TYPES)[number])} style={fieldStyle}>
                  {REPAIR_TYPES.map((type) => (
                    <option key={type} value={type}>{formatEnumLabel(type)}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Status</span>
                <select value={repairStatus} onChange={(event) => setRepairStatus(event.target.value as (typeof REPAIR_STATUSES)[number])} style={fieldStyle}>
                  {REPAIR_STATUSES.map((status) => (
                    <option key={status} value={status}>{formatEnumLabel(status)}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Priority</span>
                <select value={repairPriority} onChange={(event) => setRepairPriority(event.target.value as (typeof REPAIR_PRIORITIES)[number])} style={fieldStyle}>
                  {REPAIR_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>{formatEnumLabel(priority)}</option>
                  ))}
                </select>
              </label>
            </div>

            {renderLinkSelectors(
              repairRoomId,
              setRepairRoomId,
              repairAssetId,
              setRepairAssetId,
              repairUtilityId,
              setRepairUtilityId
            )}

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Description</span>
              <textarea value={repairDescription} onChange={(event) => setRepairDescription(event.target.value)} style={{ ...fieldStyle, minHeight: 80 }} />
            </label>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Reported date</span>
                <input type="date" value={reportedDate} onChange={(event) => setReportedDate(event.target.value)} style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Completed date</span>
                <input type="date" value={completedDate} onChange={(event) => setCompletedDate(event.target.value)} style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Estimated cost</span>
                <input type="number" step="0.01" value={estimatedCost} onChange={(event) => setEstimatedCost(event.target.value)} style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Actual cost</span>
                <input type="number" step="0.01" value={actualCost} onChange={(event) => setActualCost(event.target.value)} style={fieldStyle} />
              </label>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Visit scheduled for</span>
                <input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} style={fieldStyle} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Arrival window</span>
                <input
                  value={scheduledWindow}
                  onChange={(event) => setScheduledWindow(event.target.value)}
                  placeholder="8am – 12pm"
                  style={fieldStyle}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Contractor name</span>
                <input value={contractorName} onChange={(event) => setContractorName(event.target.value)} style={fieldStyle} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Contractor phone</span>
                <input value={contractorPhone} onChange={(event) => setContractorPhone(event.target.value)} style={fieldStyle} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Contractor email</span>
                <input type="email" value={contractorEmail} onChange={(event) => setContractorEmail(event.target.value)} style={fieldStyle} />
              </label>
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Notes</span>
              <textarea value={repairNotes} onChange={(event) => setRepairNotes(event.target.value)} style={{ ...fieldStyle, minHeight: 70 }} />
            </label>

            <div>
              <Button type="submit" disabled={savingRepair || (dataMode === 'supabase' && !hasProperty)}>
                {savingRepair ? 'Saving repair...' : 'Save repair'}
              </Button>
            </div>
          </form>
          )}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Add service history</h2>
          {!access.loading && !access.canWrite ? (
            <ViewOnlyNotice role={access.role} action="add service history" inline />
          ) : (
          <form onSubmit={submitServiceRecord} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Service title</span>
              <input value={serviceTitle} onChange={(event) => setServiceTitle(event.target.value)} style={fieldStyle} />
            </label>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Service type</span>
                <select value={serviceType} onChange={(event) => setServiceType(event.target.value as (typeof SERVICE_TYPES)[number])} style={fieldStyle}>
                  {SERVICE_TYPES.map((type) => (
                    <option key={type} value={type}>{formatEnumLabel(type)}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Service date</span>
                <input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Cost</span>
                <input type="number" step="0.01" value={serviceCost} onChange={(event) => setServiceCost(event.target.value)} style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Next service date</span>
                <input type="date" value={nextServiceDate} onChange={(event) => setNextServiceDate(event.target.value)} style={fieldStyle} />
              </label>
            </div>

            {renderLinkSelectors(
              serviceRoomId,
              setServiceRoomId,
              serviceAssetId,
              setServiceAssetId,
              serviceUtilityId,
              setServiceUtilityId
            )}

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Summary</span>
              <textarea value={serviceSummary} onChange={(event) => setServiceSummary(event.target.value)} style={{ ...fieldStyle, minHeight: 80 }} />
            </label>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Provider name</span>
                <input value={providerName} onChange={(event) => setProviderName(event.target.value)} style={fieldStyle} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Provider phone</span>
                <input value={providerPhone} onChange={(event) => setProviderPhone(event.target.value)} style={fieldStyle} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Provider email</span>
                <input type="email" value={providerEmail} onChange={(event) => setProviderEmail(event.target.value)} style={fieldStyle} />
              </label>
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Notes</span>
              <textarea value={serviceNotes} onChange={(event) => setServiceNotes(event.target.value)} style={{ ...fieldStyle, minHeight: 70 }} />
            </label>

            <div>
              <Button type="submit" disabled={savingServiceRecord || (dataMode === 'supabase' && !hasProperty)}>
                {savingServiceRecord ? 'Saving service history...' : 'Save service history'}
              </Button>
            </div>
          </form>
          )}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Find repairs</h2>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Search</span>
              <input value={repairSearch} onChange={(event) => setRepairSearch(event.target.value)} placeholder="Title, contractor, notes" style={fieldStyle} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Status</span>
              <select value={repairStatusFilter} onChange={(event) => setRepairStatusFilter(event.target.value)} style={fieldStyle}>
                <option value="">All statuses</option>
                {REPAIR_STATUSES.map((value) => (
                  <option key={value} value={value}>{formatEnumLabel(value)}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Priority</span>
              <select value={repairPriorityFilter} onChange={(event) => setRepairPriorityFilter(event.target.value)} style={fieldStyle}>
                <option value="">All priorities</option>
                {REPAIR_PRIORITIES.map((value) => (
                  <option key={value} value={value}>{formatEnumLabel(value)}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Type</span>
              <select value={repairTypeFilter} onChange={(event) => setRepairTypeFilter(event.target.value)} style={fieldStyle}>
                <option value="">All types</option>
                {REPAIR_TYPES.map((value) => (
                  <option key={value} value={value}>{formatEnumLabel(value)}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Linked to</span>
              <select value={repairLinkFilter} onChange={(event) => setRepairLinkFilter(event.target.value)} style={fieldStyle}>
                <option value="">Any item</option>
                <option value="room">Room</option>
                <option value="asset">Asset</option>
                <option value="utility">Utility</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Sort</span>
              <select value={repairSortBy} onChange={(event) => setRepairSortBy(event.target.value as 'reported_date' | 'completed_date' | 'priority' | 'status')} style={fieldStyle}>
                <option value="reported_date">Reported date</option>
                <option value="completed_date">Completed date</option>
                <option value="priority">Priority</option>
                <option value="status">Status</option>
              </select>
            </label>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Find service history</h2>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Search</span>
              <input value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder="Title, provider, summary, notes" style={fieldStyle} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Service type</span>
              <select value={serviceTypeFilter} onChange={(event) => setServiceTypeFilter(event.target.value)} style={fieldStyle}>
                <option value="">All service types</option>
                {SERVICE_TYPES.map((value) => (
                  <option key={value} value={value}>{formatEnumLabel(value)}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Linked to</span>
              <select value={serviceLinkFilter} onChange={(event) => setServiceLinkFilter(event.target.value)} style={fieldStyle}>
                <option value="">Any item</option>
                <option value="room">Room</option>
                <option value="asset">Asset</option>
                <option value="utility">Utility</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Sort</span>
              <select value={serviceSortBy} onChange={(event) => setServiceSortBy(event.target.value as 'service_date' | 'next_service_date')} style={fieldStyle}>
                <option value="service_date">Service date</option>
                <option value="next_service_date">Next service date</option>
              </select>
            </label>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Trends</h2>
          {trendFlags.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>No trends currently. Keep logging service history for better trend insight.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {trendFlags.map((flag) => (
                <div key={flag.id} style={{ padding: 10, border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <strong>{flag.title}</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    {flag.description || `${formatEnumLabel(flag.flag_type)} • ${formatEnumLabel(flag.status)} • ${formatEnumLabel(flag.severity)}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {!loading && repairs.length === 0 && serviceRecords.length === 0 ? (
          <EmptyState
            title="No repairs or service history yet"
            description="Add a repair or service history item to start building your home's maintenance history."
          />
        ) : null}

        {repairs.length > 0 ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Repairs ({filteredRepairs.length})</h2>
            {filteredRepairs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>No repairs match the current filters.</p>
            ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {filteredRepairs.map((repair) => (
                <div key={repair.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
                    <div>
                      <h3 style={{ margin: '0 0 8px 0' }}>{repair.title}</h3>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <UtilityBadge label={formatEnumLabel(repair.repair_type)} />
                        <UtilityBadge label={formatEnumLabel(repair.priority)} />
                        <UtilityBadge label={`${getIssueCountForRepair(repair.id)} linked issue${getIssueCountForRepair(repair.id) === 1 ? '' : 's'}`} />
                        {repair.room_id && <UtilityBadge label={`Room: ${roomNameFromId(rooms, repair.room_id) || 'Unknown'}`} />}
                        {repair.asset_id && <UtilityBadge label={`Asset: ${nameFromId(assets, repair.asset_id) || 'Unknown'}`} />}
                        {repair.utility_id && <UtilityBadge label={`Utility: ${nameFromId(utilities, repair.utility_id) || 'Unknown'}`} />}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'grid', gap: 4 }}>
                        <div><strong>Reported:</strong> {repair.reported_date || 'Not set'}</div>
                        {repair.completed_date && <div><strong>Completed:</strong> {repair.completed_date}</div>}
                        {repair.contractor_name && <div><strong>Contractor:</strong> {repair.contractor_name}</div>}
                        {repair.estimated_cost !== null && <div><strong>Estimated:</strong> ${repair.estimated_cost}</div>}
                        {repair.actual_cost !== null && <div><strong>Actual:</strong> ${repair.actual_cost}</div>}
                        {repair.description && <div><strong>Description:</strong> {repair.description}</div>}
                        {repair.notes && <div><strong>Notes:</strong> {repair.notes}</div>}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 8, minWidth: 140 }}>
                      <ActionLink href={`/repairs/${repair.id}`} variant="secondary">View</ActionLink>
                      <ActionLink href={`/repairs/${repair.id}/service-call`} variant="secondary">Service call sheet</ActionLink>
                      {access.loading || access.canWrite ? (
                      <>
                      <select
                        value={repair.status}
                        onChange={(event) => changeRepairStatus(repair.id, event.target.value as RepairStatus)}
                        disabled={updatingStatusId === repair.id}
                        style={fieldStyle}
                      >
                        {REPAIR_STATUSES.map((status) => (
                          <option key={status} value={status}>{formatEnumLabel(status)}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => deleteRepair(repair.id)}
                        disabled={deletingId === repair.id}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid rgba(163,78,51,0.30)',
                          background: 'rgba(163,78,51,0.08)',
                          color: 'var(--status-urgent)',
                          cursor: deletingId === repair.id ? 'not-allowed' : 'pointer',
                          opacity: deletingId === repair.id ? 0.7 : 1
                        }}
                      >
                        {deletingId === repair.id ? 'Deleting...' : 'Delete'}
                      </button>
                      </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </Card>
        ) : null}

        {serviceRecords.length > 0 ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Service History ({filteredServiceRecords.length})</h2>
            {recordNotice ? (
              <p style={{ marginTop: 0, color: 'var(--status-good)', fontWeight: 600 }} role="status">
                {recordNotice}
              </p>
            ) : null}
            {filteredServiceRecords.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>No service history matches the current filters.</p>
            ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {filteredServiceRecords.map((record) => (
                <div key={record.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
                    <div>
                      <h3 style={{ margin: '0 0 8px 0' }}>{record.service_title}</h3>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <UtilityBadge label={formatEnumLabel(record.service_type)} />
                        {record.room_id && <UtilityBadge label={`Room: ${roomNameFromId(rooms, record.room_id) || 'Unknown'}`} />}
                        {record.asset_id && <UtilityBadge label={`Asset: ${nameFromId(assets, record.asset_id) || 'Unknown'}`} />}
                        {record.utility_id && <UtilityBadge label={`Utility: ${nameFromId(utilities, record.utility_id) || 'Unknown'}`} />}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'grid', gap: 4 }}>
                        <div><strong>Date:</strong> {record.service_date}</div>
                        {record.cost !== null && <div><strong>Cost:</strong> ${record.cost}</div>}
                        {record.provider_name && <div><strong>Provider:</strong> {record.provider_name}</div>}
                        {record.next_service_date && <div><strong>Next service:</strong> {record.next_service_date}</div>}
                        {record.summary && <div><strong>Summary:</strong> {record.summary}</div>}
                        {record.notes && <div><strong>Notes:</strong> {record.notes}</div>}
                      </div>

                      {editingRecordId === record.id ? (
                        <div
                          style={{
                            marginTop: 14,
                            padding: 14,
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-card)',
                            background: 'var(--surface-page)',
                            display: 'grid',
                            gap: 12
                          }}
                        >
                          <h4 style={{ margin: 0 }}>Edit service history item</h4>

                          <label style={labelStyle}>
                            <span style={{ fontWeight: 600 }}>Service title</span>
                            <input
                              value={recordDraft.service_title}
                              onChange={(event) =>
                                setRecordDraft((draft) => ({ ...draft, service_title: event.target.value }))
                              }
                              style={fieldStyle}
                            />
                          </label>

                          <div style={fieldRowStyle}>
                            <label style={labelStyle}>
                              <span style={{ fontWeight: 600 }}>Service type</span>
                              <select
                                value={recordDraft.service_type}
                                onChange={(event) =>
                                  setRecordDraft((draft) => ({
                                    ...draft,
                                    service_type: event.target.value as (typeof SERVICE_TYPES)[number]
                                  }))
                                }
                                style={fieldStyle}
                              >
                                {SERVICE_TYPES.map((type) => (
                                  <option key={type} value={type}>{formatEnumLabel(type)}</option>
                                ))}
                              </select>
                            </label>

                            <label style={labelStyle}>
                              <span style={{ fontWeight: 600 }}>Service date</span>
                              <input
                                type="date"
                                value={recordDraft.service_date}
                                onChange={(event) =>
                                  setRecordDraft((draft) => ({ ...draft, service_date: event.target.value }))
                                }
                                style={fieldStyle}
                              />
                            </label>

                            <label style={labelStyle}>
                              <span style={{ fontWeight: 600 }}>Cost</span>
                              <input
                                type="number"
                                step="0.01"
                                value={recordDraft.cost}
                                onChange={(event) =>
                                  setRecordDraft((draft) => ({ ...draft, cost: event.target.value }))
                                }
                                style={fieldStyle}
                              />
                            </label>

                            <label style={labelStyle}>
                              <span style={{ fontWeight: 600 }}>Next service date</span>
                              <input
                                type="date"
                                value={recordDraft.next_service_date}
                                onChange={(event) =>
                                  setRecordDraft((draft) => ({ ...draft, next_service_date: event.target.value }))
                                }
                                style={fieldStyle}
                              />
                            </label>
                          </div>

                          <RoomLocationSelect
                            rooms={rooms}
                            value={recordDraft.room_choice}
                            onChange={(value) => setRecordDraft((draft) => ({ ...draft, room_choice: value }))}
                            customName={recordDraft.room_custom_name}
                            onCustomNameChange={(value) =>
                              setRecordDraft((draft) => ({ ...draft, room_custom_name: value }))
                            }
                            label="Room or location"
                            emptyLabel="Not linked to a room"
                            disabled={savingRecordEdits}
                          />

                          <div style={fieldRowStyle}>
                            <label style={labelStyle}>
                              <span style={{ fontWeight: 600 }}>Appliance or asset</span>
                              <select
                                value={recordDraft.asset_id}
                                onChange={(event) =>
                                  setRecordDraft((draft) => ({ ...draft, asset_id: event.target.value }))
                                }
                                style={fieldStyle}
                              >
                                <option value="">Not linked</option>
                                {assets.map((asset) => (
                                  <option key={asset.id} value={asset.id}>{asset.name}</option>
                                ))}
                              </select>
                            </label>

                            <label style={labelStyle}>
                              <span style={{ fontWeight: 600 }}>Utility</span>
                              <select
                                value={recordDraft.utility_id}
                                onChange={(event) =>
                                  setRecordDraft((draft) => ({ ...draft, utility_id: event.target.value }))
                                }
                                style={fieldStyle}
                              >
                                <option value="">Not linked</option>
                                {utilities.map((utility) => (
                                  <option key={utility.id} value={utility.id}>{utility.name}</option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <label style={labelStyle}>
                            <span style={{ fontWeight: 600 }}>Summary</span>
                            <textarea
                              value={recordDraft.summary}
                              onChange={(event) =>
                                setRecordDraft((draft) => ({ ...draft, summary: event.target.value }))
                              }
                              style={{ ...fieldStyle, minHeight: 80 }}
                            />
                          </label>

                          <div style={fieldRowStyle}>
                            <label style={labelStyle}>
                              <span style={{ fontWeight: 600 }}>Provider name</span>
                              <input
                                value={recordDraft.provider_name}
                                onChange={(event) =>
                                  setRecordDraft((draft) => ({ ...draft, provider_name: event.target.value }))
                                }
                                style={fieldStyle}
                              />
                            </label>

                            <label style={labelStyle}>
                              <span style={{ fontWeight: 600 }}>Provider phone</span>
                              <input
                                value={recordDraft.provider_phone}
                                onChange={(event) =>
                                  setRecordDraft((draft) => ({ ...draft, provider_phone: event.target.value }))
                                }
                                style={fieldStyle}
                              />
                            </label>

                            <label style={labelStyle}>
                              <span style={{ fontWeight: 600 }}>Provider email</span>
                              <input
                                type="email"
                                value={recordDraft.provider_email}
                                onChange={(event) =>
                                  setRecordDraft((draft) => ({ ...draft, provider_email: event.target.value }))
                                }
                                style={fieldStyle}
                              />
                            </label>
                          </div>

                          <label style={labelStyle}>
                            <span style={{ fontWeight: 600 }}>Notes</span>
                            <textarea
                              value={recordDraft.notes}
                              onChange={(event) =>
                                setRecordDraft((draft) => ({ ...draft, notes: event.target.value }))
                              }
                              style={{ ...fieldStyle, minHeight: 70 }}
                            />
                          </label>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Button
                              type="button"
                              onClick={() => saveRecordEdits(record.id)}
                              disabled={savingRecordEdits}
                            >
                              {savingRecordEdits ? 'Saving...' : 'Save changes'}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={cancelRecordEdits}
                              disabled={savingRecordEdits}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {editingRecordId === record.id || (!access.loading && !access.canWrite) ? null : (
                      <div style={{ display: 'grid', gap: 8, minWidth: 120, height: 'fit-content' }}>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => startEditingRecord(record)}
                          disabled={deletingId === record.id}
                        >
                          Edit
                        </Button>
                        <button
                          type="button"
                          onClick={() => deleteServiceRecord(record.id)}
                          disabled={deletingId === record.id}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px solid rgba(163,78,51,0.30)',
                            background: 'rgba(163,78,51,0.08)',
                            color: 'var(--status-urgent)',
                            cursor: deletingId === record.id ? 'not-allowed' : 'pointer',
                            height: 'fit-content',
                            opacity: deletingId === record.id ? 0.7 : 1
                          }}
                        >
                          {deletingId === record.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
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
