import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import {
  DOCUMENT_TYPES,
  formatEnumLabel,
  type DocumentType,
  type VisibilityContext
} from '@home-folder/shared';
import { Button, Card, ConfirmDialog, PageHeader, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { ViewOnlyNotice } from '../components/ViewOnlyNotice';
import { usePropertyAccess } from '../lib/access';
import { VisibilityContextPicker } from '../components/VisibilityContextPicker';
import { getAssetDataContext, getAssetsForContext, type AssetRow } from '../lib/assets';
import { getAutomationContext, getDevicesForContext, type AutomationDeviceRow } from '../lib/automation';
import { listComplianceObligations, type ComplianceObligationRow } from '../lib/compliance';
import { listConditionReports, type ConditionReportRow } from '../lib/conditionReports';
import { getDemoRooms } from '../lib/demoStorage';
import {
  createDocumentSignedUrlForContext,
  createDocumentThumbnailUrlsForContext,
  deleteDocumentForContext,
  formatFileSize,
  getDocumentDataContext,
  getDocumentsForContext,
  updateDocumentMetadataForContext,
  uploadDocumentForContext,
  buildDocumentFilingPatch,
  DOCUMENT_LINK_FIELDS,
  type DocumentDataContext,
  type DocumentLinkField,
  type DocumentMetadataInput,
  type DocumentRow
} from '../lib/documents';
import { getIssueDataContext, getIssuesForContext, type IssueRow } from '../lib/issues';
import { getReminderDataContext, getRemindersForContext, type ReminderRow } from '../lib/reminders';
import { getRepairDataContext, getRepairsForContext, type RepairRow } from '../lib/repairs';
import { getRoomsForProperty } from '../lib/rooms';
import { formatRoomLocation } from '../lib/roomLabels';
import { getServiceRecordDataContext, getServiceRecordsForContext, type ServiceRecordRow } from '../lib/serviceRecords';
import { listTenancies, type TenancyRow } from '../lib/tenancies';
import { getTrendFlagDataContext, getTrendFlagsForContext, type TrendFlagRow } from '../lib/trendFlags';
import { getUtilitiesForContext, getUtilityDataContext, type UtilityRow } from '../lib/utilities';
import { formatVisibilityContextList } from '../lib/visibility';

type LinkKind = 'property' | DocumentLinkField;

type LinkOption = {
  id: string;
  label: string;
};

type RoomOption = {
  id: string;
  name: string;
  room_type?: string | null;
  floor_name?: string | null;
};

const fieldStyle = {
  padding: 10,
  borderRadius: 4,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)'
};

const LINK_KINDS: Array<{ value: LinkKind; label: string }> = [
  { value: 'property', label: 'Property' },
  { value: 'room_id', label: 'Room' },
  { value: 'utility_id', label: 'Utility' },
  { value: 'asset_id', label: 'Asset' },
  { value: 'reminder_id', label: 'Reminder' },
  { value: 'repair_id', label: 'Repair' },
  { value: 'service_record_id', label: 'Service History' },
  { value: 'issue_id', label: 'Issue' },
  { value: 'trend_flag_id', label: 'Trend' },
  { value: 'automation_device_id', label: 'Smart device' },
  { value: 'tenancy_id', label: 'Tenancy' },
  { value: 'condition_report_id', label: 'Condition report' },
  { value: 'compliance_obligation_id', label: 'Compliance obligation' }
];

/**
 * Landlord-tier records live in the account only, so their options are offered
 * when there is an account to read them from — demo mode simply shows the rest.
 */
const LANDLORD_LINK_KINDS: LinkKind[] = ['tenancy_id', 'condition_report_id', 'compliance_obligation_id'];

const QUERY_TO_LINK_KIND: Record<string, LinkKind> = {
  roomId: 'room_id',
  utilityId: 'utility_id',
  assetId: 'asset_id',
  reminderId: 'reminder_id',
  repairId: 'repair_id',
  serviceRecordId: 'service_record_id',
  issueId: 'issue_id',
  trendFlagId: 'trend_flag_id',
  automationDeviceId: 'automation_device_id',
  tenancyId: 'tenancy_id',
  conditionReportId: 'condition_report_id',
  complianceObligationId: 'compliance_obligation_id'
};

function getInitialLink(routerQuery: Record<string, string | string[] | undefined>) {
  for (const [queryKey, linkKind] of Object.entries(QUERY_TO_LINK_KIND)) {
    const value = routerQuery[queryKey];
    if (typeof value === 'string' && value) {
      return { linkKind, linkId: value };
    }
  }

  return { linkKind: 'property' as LinkKind, linkId: '' };
}

function labelFromOptions(options: LinkOption[], id: string | null) {
  if (!id) return null;
  return options.find((option) => option.id === id)?.label || 'Unknown';
}

/** The record a document is currently filed against, ready for the link picker. */
function getDocumentLinkKind(document: DocumentRow): { linkKind: LinkKind; linkId: string } {
  for (const field of DOCUMENT_LINK_FIELDS) {
    const value = document[field];
    if (value) {
      return { linkKind: field, linkId: value };
    }
  }

  return { linkKind: 'property', linkId: '' };
}

function getDocumentLinkLabel(document: DocumentRow, optionsByKind: Record<LinkKind, LinkOption[]>) {
  const { linkKind, linkId } = getDocumentLinkKind(document);
  if (linkKind === 'property') {
    return 'Property';
  }

  const kindLabel = LINK_KINDS.find((kind) => kind.value === linkKind)?.label || 'Record';
  return `${kindLabel}: ${labelFromOptions(optionsByKind[linkKind], linkId)}`;
}

function buildLinkPayload(linkKind: LinkKind, linkId: string) {
  if (linkKind === 'property' || !linkId) {
    return {};
  }

  return { [linkKind]: linkId };
}

/**
 * Re-filing has to clear the old foreign key as well as set the new one —
 * otherwise a document moved from a repair to a room would show up under both.
 * Filing it under the property itself simply clears them all.
 */
function buildLinkUpdatePayload(linkKind: LinkKind, linkId: string): DocumentMetadataInput {
  return buildDocumentFilingPatch(linkKind === 'property' || !linkId ? null : { field: linkKind, id: linkId });
}

export default function DocumentsPage() {
  const router = useRouter();

  const access = usePropertyAccess();
  const [context, setContext] = useState<DocumentDataContext | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(new Map());

  // Fetch signed thumbnail URLs in one batch whenever the list changes —
  // thumbnails are ~15 KB, so browsing the file cabinet stays near-zero egress.
  useEffect(() => {
    let isMounted = true;

    if (!context || documents.every((document) => !document.thumbnail_path)) {
      return;
    }

    createDocumentThumbnailUrlsForContext(context, documents)
      .then((urls) => {
        if (isMounted) {
          setThumbnailUrls(urls);
        }
      })
      .catch(() => {
        // thumbnails are decorative — never surface an error for them
      });

    return () => {
      isMounted = false;
    };
  }, [context, documents]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [utilities, setUtilities] = useState<UtilityRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [automationDevices, setAutomationDevices] = useState<AutomationDeviceRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [repairs, setRepairs] = useState<RepairRow[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [trendFlags, setTrendFlags] = useState<TrendFlagRow[]>([]);
  const [tenancies, setTenancies] = useState<TenancyRow[]>([]);
  const [conditionReports, setConditionReports] = useState<ConditionReportRow[]>([]);
  const [complianceObligations, setComplianceObligations] = useState<ComplianceObligationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [actingDocumentId, setActingDocumentId] = useState<string | null>(null);
  // Two-step deletion: the Delete button only opens the ConfirmDialog;
  // window.confirm proved unreliable (a suppressed dialog returns false and
  // the click dies silently), so nothing is removed until the dialog confirms.
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('other');
  const [visibilityContexts, setVisibilityContexts] = useState<VisibilityContext[]>(['personal_archive']);
  const [linkKind, setLinkKind] = useState<LinkKind>('property');
  const [linkId, setLinkId] = useState('');

  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<DocumentType>('other');
  const [editVisibilityContexts, setEditVisibilityContexts] = useState<VisibilityContext[]>(['personal_archive']);
  const [editLinkKind, setEditLinkKind] = useState<LinkKind>('property');
  const [editLinkId, setEditLinkId] = useState('');

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const initialLink = getInitialLink(router.query);
    setLinkKind(initialLink.linkKind);
    setLinkId(initialLink.linkId);
  }, [router.isReady, router.query]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError('');
      setNotice('');

      try {
        const [
          nextContext,
          utilityContext,
          assetContext,
          reminderContext,
          repairContext,
          serviceRecordContext,
          issueContext,
          trendFlagContext
        ] = await Promise.all([
          getDocumentDataContext(),
          getUtilityDataContext(),
          getAssetDataContext(),
          getReminderDataContext(),
          getRepairDataContext(),
          getServiceRecordDataContext(),
          getIssueDataContext(),
          getTrendFlagDataContext()
        ]);

        const [
          nextDocuments,
          roomRows,
          utilityRows,
          assetRows,
          reminderRows,
          repairRows,
          serviceRows,
          issueRows,
          trendRows
        ] = await Promise.all([
          getDocumentsForContext(nextContext),
          nextContext.mode === 'supabase' && nextContext.property
            ? getRoomsForProperty(nextContext.property.id)
            : Promise.resolve(getDemoRooms()),
          getUtilitiesForContext(utilityContext),
          getAssetsForContext(assetContext),
          getRemindersForContext(reminderContext),
          getRepairsForContext(repairContext),
          getServiceRecordsForContext(serviceRecordContext),
          getIssuesForContext(issueContext),
          getTrendFlagsForContext(trendFlagContext)
        ]);

        const automationContext = await getAutomationContext();
        const automationDeviceRows = await getDevicesForContext(automationContext);

        // Landlord records are account-only; demo mode simply goes without them.
        const [tenancyRows, conditionReportRows, obligationRows] =
          nextContext.mode === 'supabase' && nextContext.property
            ? await Promise.all([
                listTenancies(nextContext.property.id),
                listConditionReports(nextContext.property.id),
                listComplianceObligations(nextContext.property.id)
              ])
            : [[] as TenancyRow[], [] as ConditionReportRow[], [] as ComplianceObligationRow[]];

        if (!isMounted) {
          return;
        }

        setTenancies(tenancyRows);
        setConditionReports(conditionReportRows);
        setComplianceObligations(obligationRows);

        setContext(nextContext);
        setDocuments(nextDocuments);
        setAutomationDevices(automationDeviceRows);
        setRooms(roomRows);
        setUtilities(utilityRows);
        setAssets(assetRows);
        setReminders(reminderRows);
        setRepairs(repairRows);
        setServiceRecords(serviceRows);
        setIssues(issueRows);
        setTrendFlags(trendRows);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load documents.');
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

  const optionsByKind = useMemo<Record<LinkKind, LinkOption[]>>(
    () => ({
      property: context?.property ? [{ id: context.property.id, label: context.property.nickname }] : [],
      room_id: rooms.map((room) => ({ id: room.id, label: formatRoomLocation(room) })),
      utility_id: utilities.map((utility) => ({ id: utility.id, label: utility.name })),
      asset_id: assets.map((asset) => ({ id: asset.id, label: asset.name })),
      reminder_id: reminders.map((reminder) => ({ id: reminder.id, label: reminder.title })),
      repair_id: repairs.map((repair) => ({ id: repair.id, label: repair.title })),
      service_record_id: serviceRecords.map((record) => ({ id: record.id, label: record.service_title })),
      issue_id: issues.map((issue) => ({ id: issue.id, label: issue.title })),
      trend_flag_id: trendFlags.map((flag) => ({ id: flag.id, label: flag.title })),
      automation_device_id: automationDevices.map((device) => ({ id: device.id, label: device.nickname || device.name })),
      tenancy_id: tenancies.map((tenancy) => ({ id: tenancy.id, label: tenancy.label })),
      condition_report_id: conditionReports.map((report) => ({
        id: report.id,
        label: `${formatEnumLabel(report.report_type)} — ${report.report_date}`
      })),
      compliance_obligation_id: complianceObligations.map((obligation) => ({
        id: obligation.id,
        label: obligation.title
      }))
    }),
    [
      assets,
      automationDevices,
      complianceObligations,
      conditionReports,
      context?.property,
      issues,
      reminders,
      repairs,
      rooms,
      serviceRecords,
      tenancies,
      trendFlags,
      utilities
    ]
  );

  const canUpload = context?.mode === 'supabase' && Boolean(context.property);

  // Landlord options are hidden rather than shown empty when there is no
  // account behind them.
  const linkKinds = useMemo(
    () =>
      LINK_KINDS.filter(
        (kind) => context?.mode === 'supabase' || !LANDLORD_LINK_KINDS.includes(kind.value)
      ),
    [context?.mode]
  );

  const currentLinkOptions = optionsByKind[linkKind] || [];
  const currentEditLinkOptions = optionsByKind[editLinkKind] || [];

  const resetUploadForm = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    setDocumentType('other');
    setVisibilityContexts(['personal_archive']);
  };

  const handleFileChange = (nextFile: File | null) => {
    setFile(nextFile);

    if (nextFile && !title.trim()) {
      setTitle(nextFile.name.replace(/\.[^.]+$/, ''));
    }
  };

  const uploadDocument = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!context) {
      setError('File details are still loading. Please try again.');
      return;
    }

    if (!file) {
      setError('Choose a file to upload.');
      return;
    }

    if (linkKind !== 'property' && !linkId) {
      setError(`Choose a ${LINK_KINDS.find((kind) => kind.value === linkKind)?.label.toLowerCase() || 'record'} to link.`);
      return;
    }

    setUploading(true);
    setError('');
    setNotice('');

    try {
      const created = await uploadDocumentForContext(context, {
        file,
        title,
        description,
        document_type: documentType,
        visibility_contexts: visibilityContexts,
        ...buildLinkPayload(linkKind, linkId)
      });

      setDocuments((current) => [created, ...current]);
      resetUploadForm();
      setNotice('Document uploaded.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const openDocument = async (documentId: string) => {
    if (!context) return;

    setActingDocumentId(documentId);
    setError('');
    setNotice('');

    try {
      const { signedUrl } = await createDocumentSignedUrlForContext(context, documentId);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Failed to open document.');
    } finally {
      setActingDocumentId(null);
    }
  };

  const requestDeleteDocument = (document: DocumentRow) => {
    setError('');
    setDeleteTarget(document);
  };

  const cancelDeleteDocument = () => {
    if (actingDocumentId !== null) {
      return;
    }
    setDeleteTarget(null);
  };

  const handleConfirmDeleteDocument = async () => {
    if (!context || !deleteTarget || actingDocumentId !== null) return;

    const documentId = deleteTarget.id;

    setActingDocumentId(documentId);
    setError('');
    setNotice('');

    try {
      await deleteDocumentForContext(context, documentId);
      setDocuments((current) => current.filter((document) => document.id !== documentId));
      setDeleteTarget(null);
      setNotice('Document deleted.');
    } catch (deleteError) {
      // Close the dialog so the error is readable on the page.
      setDeleteTarget(null);
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete document.');
    } finally {
      setActingDocumentId(null);
    }
  };

  const startEditing = (document: DocumentRow) => {
    const documentLink = getDocumentLinkKind(document);
    setEditingDocumentId(document.id);
    setEditTitle(document.title);
    setEditDescription(document.description || '');
    setEditType(document.document_type);
    setEditVisibilityContexts(document.visibility_contexts);
    setEditLinkKind(documentLink.linkKind);
    setEditLinkId(documentLink.linkId);
  };

  const saveMetadata = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!context || !editingDocumentId) {
      return;
    }

    if (editLinkKind !== 'property' && !editLinkId) {
      setError(`Choose a ${LINK_KINDS.find((kind) => kind.value === editLinkKind)?.label.toLowerCase() || 'record'} to link.`);
      return;
    }

    setActingDocumentId(editingDocumentId);
    setError('');
    setNotice('');

    try {
      const updated = await updateDocumentMetadataForContext(context, editingDocumentId, {
        title: editTitle,
        description: editDescription,
        document_type: editType,
        visibility_contexts: editVisibilityContexts,
        ...buildLinkUpdatePayload(editLinkKind, editLinkId)
      });

      if (updated) {
        setDocuments((current) => current.map((document) => (document.id === updated.id ? updated : document)));
      }

      setEditingDocumentId(null);
      setNotice('Document updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update document.');
    } finally {
      setActingDocumentId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Documents"
        description="A private file cabinet for manuals, warranties, reports, photos, permits, and home records."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <UtilityBadge label={`${documents.length} document${documents.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={context?.mode === 'supabase' ? 'Private files' : 'Demo data'} />
            {context?.property ? <UtilityBadge label={context.property.nickname} /> : null}
          </div>
          {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading documents...</p> : null}
          {error ? <p style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p> : null}
          {notice ? <p style={{ color: 'var(--status-good)', fontWeight: 700 }}>{notice}</p> : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Upload document</h2>
          {!canUpload ? (
            <div>
              <p style={{ color: 'var(--text-muted)' }}>
                Sign in and create a property to upload private files. No public file link is created.
              </p>
              <ActionLink href="/sign-in">Sign in</ActionLink>
            </div>
          ) : !access.loading && !access.canWrite ? (
            <ViewOnlyNotice role={access.role} action="upload documents" inline />
          ) : (
            <form onSubmit={uploadDocument} style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>File</span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp,text/plain"
                  onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
                  style={fieldStyle}
                />
              </label>

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Title</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} style={fieldStyle} />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Type</span>
                  <select value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)} style={fieldStyle}>
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type} value={type}>{formatEnumLabel(type)}</option>
                    ))}
                  </select>
                </label>

                <VisibilityContextPicker
                  idPrefix="document-visibility-contexts"
                  value={visibilityContexts}
                  onChange={setVisibilityContexts}
                  disabled={uploading}
                />
              </div>

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Link to</span>
                  <select
                    value={linkKind}
                    onChange={(event) => {
                      setLinkKind(event.target.value as LinkKind);
                      setLinkId('');
                    }}
                    style={fieldStyle}
                  >
                    {linkKinds.map((kind) => (
                      <option key={kind.value} value={kind.value}>{kind.label}</option>
                    ))}
                  </select>
                </label>

                {linkKind !== 'property' ? (
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>Record</span>
                    <select value={linkId} onChange={(event) => setLinkId(event.target.value)} style={fieldStyle}>
                      <option value="">Choose record</option>
                      {currentLinkOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Description</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} style={{ ...fieldStyle, minHeight: 76 }} />
              </label>

              <div>
                <Button type="submit" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload document'}
                </Button>
              </div>
            </form>
          )}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Document library</h2>
          {documents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Keep manuals, warranties, reports, and files in one place.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {documents.map((document) => {
                const isEditing = editingDocumentId === document.id;
                const isActing = actingDocumentId === document.id;

                return (
                  <div key={document.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                    {isEditing ? (
                      <form onSubmit={saveMetadata} style={{ display: 'grid', gap: 10 }}>
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>Title</span>
                          <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} style={fieldStyle} />
                        </label>
                        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                          <label style={{ display: 'grid', gap: 6 }}>
                            <span style={{ fontWeight: 600 }}>Type</span>
                            <select value={editType} onChange={(event) => setEditType(event.target.value as DocumentType)} style={fieldStyle}>
                              {DOCUMENT_TYPES.map((type) => (
                                <option key={type} value={type}>{formatEnumLabel(type)}</option>
                              ))}
                            </select>
                          </label>
                          <VisibilityContextPicker
                            idPrefix={`document-${document.id}-visibility-contexts`}
                            value={editVisibilityContexts}
                            onChange={setEditVisibilityContexts}
                            disabled={isActing}
                          />
                        </div>
                        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                          <label style={{ display: 'grid', gap: 6 }}>
                            <span style={{ fontWeight: 600 }}>Filed under</span>
                            <select
                              value={editLinkKind}
                              onChange={(event) => {
                                setEditLinkKind(event.target.value as LinkKind);
                                setEditLinkId('');
                              }}
                              disabled={isActing}
                              style={fieldStyle}
                            >
                              {linkKinds.map((kind) => (
                                <option key={kind.value} value={kind.value}>{kind.label}</option>
                              ))}
                            </select>
                          </label>

                          {editLinkKind !== 'property' ? (
                            <label style={{ display: 'grid', gap: 6 }}>
                              <span style={{ fontWeight: 600 }}>Record</span>
                              <select
                                value={editLinkId}
                                onChange={(event) => setEditLinkId(event.target.value)}
                                disabled={isActing}
                                style={fieldStyle}
                              >
                                <option value="">Choose record</option>
                                {currentEditLinkOptions.map((option) => (
                                  <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                          Moving a document files it under the new record and removes it from the old one.
                        </p>

                        <label style={{ display: 'grid', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>Description</span>
                          <textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} style={{ ...fieldStyle, minHeight: 70 }} />
                        </label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Button type="submit" disabled={isActing}>{isActing ? 'Saving...' : 'Save'}</Button>
                          <Button type="button" onClick={() => setEditingDocumentId(null)} style={{ background: 'var(--text-muted)' }}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
                            {thumbnailUrls.has(document.id) ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={thumbnailUrls.get(document.id)}
                                alt=""
                                width={52}
                                height={52}
                                style={{
                                  width: 52,
                                  height: 52,
                                  objectFit: 'cover',
                                  borderRadius: 4,
                                  border: '1px solid var(--border-subtle)',
                                  flexShrink: 0
                                }}
                              />
                            ) : null}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700 }}>{document.title}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                {document.file_name} • {formatFileSize(document.file_size_bytes)} • {new Date(document.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <UtilityBadge label={formatEnumLabel(document.document_type)} />
                            <UtilityBadge label={formatVisibilityContextList(document.visibility_contexts)} />
                          </div>
                        </div>

                        {document.description ? (
                          <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{document.description}</p>
                        ) : null}

                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 8 }}>
                          {getDocumentLinkLabel(document, optionsByKind)}
                        </p>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                          <Button type="button" onClick={() => openDocument(document.id)} disabled={isActing}>
                            {isActing ? 'Opening...' : 'View / download'}
                          </Button>
                          {access.loading || access.canWrite ? (
                          <Button type="button" onClick={() => startEditing(document)} style={{ background: 'var(--text-muted)' }}>
                            Edit details
                          </Button>
                          ) : null}
                          {document.document_type === 'receipt' ? (
                            <ActionLink href={`/receipts?documentId=${document.id}`} variant="secondary">
                              Review receipt
                            </ActionLink>
                          ) : null}
                          {access.loading || access.canWrite ? (
                          <button
                            type="button"
                            onClick={() => requestDeleteDocument(document)}
                            disabled={isActing}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 6,
                              border: '1px solid rgba(163,78,51,0.30)',
                              background: 'rgba(163,78,51,0.08)',
                              color: 'var(--status-urgent)',
                              cursor: isActing ? 'not-allowed' : 'pointer',
                              fontWeight: 700,
                              opacity: isActing ? 0.7 : 1
                            }}
                          >
                            Delete
                          </button>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <ActionLink href="/dashboard" variant="secondary">Back to dashboard</ActionLink>
          <ActionLink href="/home-map" variant="secondary">Back to home map</ActionLink>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget ? `Delete ${deleteTarget.title}?` : 'Delete document?'}
        description="Its private file will be removed after the undo window in supported flows."
        confirmLabel="Delete document"
        cancelLabel="Keep document"
        busy={actingDocumentId !== null && actingDocumentId === deleteTarget?.id}
        onConfirm={handleConfirmDeleteDocument}
        onCancel={cancelDeleteDocument}
      />
    </>
  );
}
