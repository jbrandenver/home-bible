import { useEffect, useMemo, useState } from 'react';
import {
  formatEnumLabel,
  REPAIR_PRIORITIES,
  REPAIR_STATUSES,
  REPAIR_TYPES,
  SERVICE_TYPES
} from '@home-bible/shared';
import { Button, Card, EmptyState, PageHeader, UtilityBadge } from '@home-bible/ui';
import { detectTrendFlags, type IssueRecord } from '../components/trendFlags';
import { getAssetsForProperty, getDemoAssets, type AssetRow } from '../lib/assets';
import { getDemoCollection, getDemoRooms } from '../lib/demoStorage';
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
  type ServiceRecordDataContext,
  type ServiceRecordRow
} from '../lib/serviceRecords';
import { getRoomsForProperty } from '../lib/rooms';
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

export default function RepairsPage() {
  const [repairContext, setRepairContext] = useState<RepairDataContext | null>(null);
  const [serviceContext, setServiceContext] = useState<ServiceRecordDataContext | null>(null);
  const [dataMode, setDataMode] = useState<'demo' | 'supabase'>('demo');
  const [hasProperty, setHasProperty] = useState(false);
  const [repairs, setRepairs] = useState<RepairRow[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [rooms, setRooms] = useState<LinkOption[]>([]);
  const [assets, setAssets] = useState<LinkOption[]>([]);
  const [utilities, setUtilities] = useState<LinkOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [savingRepair, setSavingRepair] = useState(false);
  const [savingServiceRecord, setSavingServiceRecord] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const [repairTitle, setRepairTitle] = useState('');
  const [repairDescription, setRepairDescription] = useState('');
  const [repairType, setRepairType] = useState<(typeof REPAIR_TYPES)[number]>('general');
  const [repairStatus, setRepairStatus] = useState<(typeof REPAIR_STATUSES)[number]>('open');
  const [repairPriority, setRepairPriority] = useState<(typeof REPAIR_PRIORITIES)[number]>('normal');
  const [reportedDate, setReportedDate] = useState(new Date().toISOString().slice(0, 10));
  const [completedDate, setCompletedDate] = useState('');
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
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
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

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setLoadError('');

      const errors: string[] = [];
      const [nextRepairContext, nextServiceContext] = await Promise.all([
        getRepairDataContext(),
        getServiceRecordDataContext()
      ]);
      let nextRepairs: RepairRow[] = [];
      let nextServiceRecords: ServiceRecordRow[] = [];
      let nextRooms: LinkOption[] = [];
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
        errors.push(loadRecordsError instanceof Error ? loadRecordsError.message : 'Failed to load service records.');
      }

      try {
        if (nextRepairContext.mode === 'supabase' && nextRepairContext.property) {
          const [roomRows, assetRows, utilityRows] = await Promise.all([
            getRoomsForProperty(nextRepairContext.property.id),
            getAssetsForProperty(nextRepairContext.property.id),
            getUtilitiesForProperty(nextRepairContext.property.id)
          ]);

          nextRooms = roomRows.map((room) => ({ id: room.id, name: room.name }));
          nextAssets = assetRows.map((asset: AssetRow) => ({ id: asset.id, name: asset.name }));
          nextUtilities = utilityRows.map((utility: UtilityRow) => ({ id: utility.id, name: utility.name }));
        } else {
          nextRooms = getDemoRooms().map((room) => ({ id: room.id, name: room.name }));
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
      setIssues(getDemoCollection<IssueRecord>('homeBible.issues'));
      setLoadError(errors.join(' '));
      setLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const trendFlags = useMemo(() => detectTrendFlags(serviceRecords, issues), [serviceRecords, issues]);
  const openRepairCount = useMemo(
    () => repairs.filter((repair) => repair.status === 'open').length,
    [repairs]
  );

  const resetRepairForm = () => {
    setRepairTitle('');
    setRepairDescription('');
    setRepairType('general');
    setRepairStatus('open');
    setRepairPriority('normal');
    setReportedDate(new Date().toISOString().slice(0, 10));
    setCompletedDate('');
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
    setServiceDate(new Date().toISOString().slice(0, 10));
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
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to save service record.');
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

  const deleteServiceRecord = async (recordId: string) => {
    if (!serviceContext) {
      return;
    }

    setDeletingId(recordId);
    setFormError('');

    try {
      await deleteServiceRecordForContext(serviceContext, recordId);
      setServiceRecords((currentRecords) => currentRecords.filter((record) => record.id !== recordId));
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : 'Failed to delete service record.');
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
            <option key={room.id} value={room.id}>{room.name}</option>
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
        title="Repairs & Service Records"
        description="Track open repairs and completed service history for rooms, assets, and utilities."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <UtilityBadge label={`${openRepairCount} open repair${openRepairCount === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${repairs.length} repair${repairs.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${serviceRecords.length} service record${serviceRecords.length === 1 ? '' : 's'}`} />
          </div>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? '#065f46' : '#6b7280' }}>
            {dataMode === 'supabase'
              ? 'Signed-in mode: repairs and service records are loaded from Supabase.'
              : 'Demo mode: repairs and service records are stored in localStorage.'}
          </p>
          {loading ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#6b7280' }}>Loading repairs and service history...</p>
          ) : null}
          {loadError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>{loadError}</p>
          ) : null}
          {dataMode === 'supabase' && !hasProperty ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#6b7280' }}>
              Create a property before adding Supabase repairs or service records.
            </p>
          ) : null}
          {formError ? (
            <div style={{ marginTop: 12, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: 10 }}>
              {formError}
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Add repair</h2>
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
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Add service record</h2>
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
                {savingServiceRecord ? 'Saving service record...' : 'Save service record'}
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Trend flags</h2>
          {trendFlags.length === 0 ? (
            <p style={{ color: '#6b7280', margin: 0 }}>No trend flags currently. Keep logging service records for better trend insight.</p>
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

        {!loading && repairs.length === 0 && serviceRecords.length === 0 ? (
          <EmptyState
            title="No repairs or service records yet"
            description="Add a repair or service record to start building your home's maintenance history."
          />
        ) : null}

        {repairs.length > 0 ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Repairs</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {repairs.map((repair) => (
                <div key={repair.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
                    <div>
                      <h3 style={{ margin: '0 0 8px 0' }}>{repair.title}</h3>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <UtilityBadge label={formatEnumLabel(repair.repair_type)} />
                        <UtilityBadge label={formatEnumLabel(repair.priority)} />
                        {repair.room_id && <UtilityBadge label={`Room: ${nameFromId(rooms, repair.room_id) || 'Unknown'}`} />}
                        {repair.asset_id && <UtilityBadge label={`Asset: ${nameFromId(assets, repair.asset_id) || 'Unknown'}`} />}
                        {repair.utility_id && <UtilityBadge label={`Utility: ${nameFromId(utilities, repair.utility_id) || 'Unknown'}`} />}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '0.9rem', display: 'grid', gap: 4 }}>
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
                          border: '1px solid #fecaca',
                          background: '#fef2f2',
                          color: '#b91c1c',
                          cursor: deletingId === repair.id ? 'not-allowed' : 'pointer',
                          opacity: deletingId === repair.id ? 0.7 : 1
                        }}
                      >
                        {deletingId === repair.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {serviceRecords.length > 0 ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Service Records</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {serviceRecords.map((record) => (
                <div key={record.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
                    <div>
                      <h3 style={{ margin: '0 0 8px 0' }}>{record.service_title}</h3>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <UtilityBadge label={formatEnumLabel(record.service_type)} />
                        {record.room_id && <UtilityBadge label={`Room: ${nameFromId(rooms, record.room_id) || 'Unknown'}`} />}
                        {record.asset_id && <UtilityBadge label={`Asset: ${nameFromId(assets, record.asset_id) || 'Unknown'}`} />}
                        {record.utility_id && <UtilityBadge label={`Utility: ${nameFromId(utilities, record.utility_id) || 'Unknown'}`} />}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '0.9rem', display: 'grid', gap: 4 }}>
                        <div><strong>Date:</strong> {record.service_date}</div>
                        {record.cost !== null && <div><strong>Cost:</strong> ${record.cost}</div>}
                        {record.provider_name && <div><strong>Provider:</strong> {record.provider_name}</div>}
                        {record.next_service_date && <div><strong>Next service:</strong> {record.next_service_date}</div>}
                        {record.summary && <div><strong>Summary:</strong> {record.summary}</div>}
                        {record.notes && <div><strong>Notes:</strong> {record.notes}</div>}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteServiceRecord(record.id)}
                      disabled={deletingId === record.id}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#b91c1c',
                        cursor: deletingId === record.id ? 'not-allowed' : 'pointer',
                        height: 'fit-content',
                        opacity: deletingId === record.id ? 0.7 : 1
                      }}
                    >
                      {deletingId === record.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
