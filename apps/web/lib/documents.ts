import { formatDataError } from './errors';
import {
  DOCUMENT_SOURCES,
  DOCUMENT_TYPES,
  DOCUMENT_VISIBILITIES,
  type DocumentRow as SharedDocumentRow,
  type DocumentSource,
  type DocumentType,
  type DocumentVisibility,
  type VisibilityContext
} from '@home-folder/shared';
import type { User } from '@supabase/supabase-js';
import { ensureProfileForUser, getCurrentUser, getSupabaseSetupMessage, isSupabaseConfigured } from './auth';
import { isCompressibleImage, prepareImageForUpload } from './images';
import { getPrimaryPropertyForUser, type PropertySummary } from './properties';
import { getSupabaseBrowserClient } from './supabase/client';
import { normalizeVisibilityContexts, visibilityFromContexts } from './visibility';

export const HOME_DOCUMENTS_BUCKET = 'home-documents';
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
// Photos are compressed client-side before upload; anything still over 5 MB
// after compression is rejected as a storage-cost guardrail.
export const MAX_PHOTO_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain'
] as const;

const PHASE_6I_MIGRATION = 'supabase/migrations/007_phase6i_documents_storage.sql';

const MIME_BY_EXTENSION: Record<string, (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number]> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  txt: 'text/plain'
};

export type DocumentDataMode = 'demo' | 'supabase';

/**
 * The landlord-tier foreign keys (migration 023) are newer than the shared
 * row type, so they are layered on here as optional fields. Optional keeps
 * every existing `DocumentRow` producer and consumer valid while letting the
 * documents page read and re-link them.
 */
export type DocumentRow = SharedDocumentRow & {
  tenancy_id?: string | null;
  condition_report_id?: string | null;
  condition_report_entry_id?: string | null;
  compliance_obligation_id?: string | null;
};

export type DocumentDataContext = {
  mode: DocumentDataMode;
  supabaseConfigured: boolean;
  user: User | null;
  property: PropertySummary | null;
};

export type DocumentLinkInput = {
  room_id?: string | null;
  utility_id?: string | null;
  asset_id?: string | null;
  reminder_id?: string | null;
  repair_id?: string | null;
  service_record_id?: string | null;
  issue_id?: string | null;
  trend_flag_id?: string | null;
  automation_device_id?: string | null;
  tenancy_id?: string | null;
  condition_report_id?: string | null;
  compliance_obligation_id?: string | null;
};

export type DocumentUploadInput = DocumentLinkInput & {
  file: File;
  title: string;
  description?: string | null;
  document_type?: DocumentType;
  visibility?: DocumentVisibility;
  visibility_contexts?: VisibilityContext[];
};

export type DocumentMetadataInput = Partial<DocumentLinkInput> & {
  title?: string;
  description?: string | null;
  document_type?: DocumentType;
  visibility?: DocumentVisibility;
  visibility_contexts?: VisibilityContext[];
};

export type DocumentLinkField =
  | 'room_id'
  | 'utility_id'
  | 'asset_id'
  | 'reminder_id'
  | 'repair_id'
  | 'service_record_id'
  | 'issue_id'
  | 'trend_flag_id'
  | 'automation_device_id'
  | 'tenancy_id'
  | 'condition_report_id'
  | 'compliance_obligation_id';

/** Every record a document can be filed against, in the order pages offer them. */
export const DOCUMENT_LINK_FIELDS: DocumentLinkField[] = [
  'room_id',
  'utility_id',
  'asset_id',
  'reminder_id',
  'repair_id',
  'service_record_id',
  'issue_id',
  'trend_flag_id',
  'automation_device_id',
  'tenancy_id',
  'condition_report_id',
  'compliance_obligation_id'
];

export type DocumentLinkTarget = {
  field: DocumentLinkField;
  id: string;
};

const DOCUMENT_SELECT =
  'id, property_id, room_id, utility_id, asset_id, reminder_id, repair_id, service_record_id, issue_id, trend_flag_id, automation_device_id, tenancy_id, condition_report_id, condition_report_entry_id, compliance_obligation_id, document_type, title, description, file_name, file_path, thumbnail_path, bucket_name, mime_type, file_size_bytes, visibility, visibility_contexts, source, created_by, created_at, updated_at, deleted_at';

/**
 * The `?roomId=…` style query keys the documents page reads, so a detail page's
 * "add document" href doubles as a description of the record it belongs to.
 * Pure: used by RelatedDocuments to attach an existing file without every
 * caller having to pass the foreign key twice.
 */
const QUERY_KEY_TO_LINK_FIELD: Record<string, DocumentLinkField> = {
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

/** Read the record a `/documents?roomId=…` href points at. Null when it names none. */
export function parseDocumentLinkTargetFromHref(href: string): DocumentLinkTarget | null {
  const queryStart = href.indexOf('?');
  if (queryStart < 0) {
    return null;
  }

  const params = new URLSearchParams(href.slice(queryStart + 1));

  for (const [queryKey, field] of Object.entries(QUERY_KEY_TO_LINK_FIELD)) {
    const value = params.get(queryKey);
    if (value) {
      return { field, id: value };
    }
  }

  return null;
}

/**
 * A patch that files a document under exactly one record, clearing any earlier
 * filing. A document belongs in one place in the folder — the same assumption
 * every list and label in the app already makes — so re-filing has to remove
 * the old link as well as write the new one. `null` files it under the
 * property itself.
 */
export function buildDocumentFilingPatch(target: DocumentLinkTarget | null): DocumentMetadataInput {
  const patch: Partial<Record<DocumentLinkField, string | null>> = {};

  for (const field of DOCUMENT_LINK_FIELDS) {
    patch[field] = target && target.field === field ? target.id : null;
  }

  return patch;
}

/** True when the document is already filed against this record. */
export function isDocumentLinkedTo(document: DocumentRow, target: DocumentLinkTarget) {
  return document[target.field] === target.id;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function enumValue<T extends readonly string[]>(values: T, value: unknown, fallback: T[number]): T[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function normalizeDocument(raw: Partial<DocumentRow>): DocumentRow {
  const createdAt = raw.created_at || new Date().toISOString();
  const visibility = enumValue(DOCUMENT_VISIBILITIES, raw.visibility, 'private');

  return {
    id: raw.id || crypto.randomUUID(),
    property_id: raw.property_id || '',
    room_id: nullableString(raw.room_id),
    utility_id: nullableString(raw.utility_id),
    asset_id: nullableString(raw.asset_id),
    reminder_id: nullableString(raw.reminder_id),
    repair_id: nullableString(raw.repair_id),
    service_record_id: nullableString(raw.service_record_id),
    issue_id: nullableString(raw.issue_id),
    trend_flag_id: nullableString(raw.trend_flag_id),
    automation_device_id: nullableString(raw.automation_device_id),
    tenancy_id: nullableString(raw.tenancy_id),
    condition_report_id: nullableString(raw.condition_report_id),
    condition_report_entry_id: nullableString(raw.condition_report_entry_id),
    compliance_obligation_id: nullableString(raw.compliance_obligation_id),
    document_type: enumValue(DOCUMENT_TYPES, raw.document_type, 'other'),
    title: raw.title?.trim() || raw.file_name?.trim() || 'Untitled document',
    description: nullableString(raw.description),
    file_name: raw.file_name?.trim() || 'document',
    file_path: raw.file_path?.trim() || '',
    thumbnail_path: nullableString(raw.thumbnail_path),
    bucket_name: HOME_DOCUMENTS_BUCKET,
    mime_type: nullableString(raw.mime_type),
    file_size_bytes:
      typeof raw.file_size_bytes === 'number' && Number.isFinite(raw.file_size_bytes)
        ? raw.file_size_bytes
        : null,
    visibility,
    visibility_contexts: normalizeVisibilityContexts(raw.visibility_contexts, visibility),
    source: enumValue(DOCUMENT_SOURCES, raw.source, 'manual_upload'),
    created_by: nullableString(raw.created_by),
    created_at: createdAt,
    updated_at: raw.updated_at || createdAt,
    deleted_at: raw.deleted_at || null
  };
}

function sortDocuments(documents: DocumentRow[]) {
  return documents.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function formatDocumentError(action: string, message?: string) {
  const detail = message || `Failed to ${action}.`;
  const lowerMessage = detail.toLowerCase();
  const needsMigration =
    lowerMessage.includes('relation') ||
    lowerMessage.includes('schema cache') ||
    lowerMessage.includes('bucket') ||
    lowerMessage.includes('column') ||
    lowerMessage.includes('constraint') ||
    lowerMessage.includes('violates row-level security') ||
    lowerMessage.includes('policy') ||
    lowerMessage.includes('invalid input value');

  return formatDataError(
    action,
    detail,
    needsMigration ? `Apply ${PHASE_6I_MIGRATION} to your Supabase project, then try again.` : undefined
  );
}

function getExtension(fileName: string) {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
}

function getAllowedMimeType(file: File) {
  const browserMime = file.type.toLowerCase();
  if ((ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(browserMime)) {
    return browserMime as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];
  }

  return MIME_BY_EXTENSION[getExtension(file.name)] || null;
}

function validateFile(file: File) {
  if (!file) {
    throw new Error('Choose a file to upload.');
  }

  if (file.size <= 0) {
    throw new Error('The selected file is empty.');
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw new Error('Files must be 10 MB or smaller.');
  }

  const mimeType = getAllowedMimeType(file);
  if (!mimeType) {
    throw new Error('Only PDF, JPEG, PNG, WebP, and plain text files are allowed.');
  }

  // Cost guardrail: photos are compressed client-side before this check, so a
  // photo still over 5 MB is almost certainly a raw export that doesn't belong here.
  if (isCompressibleImage(mimeType) && file.size > MAX_PHOTO_FILE_SIZE_BYTES) {
    throw new Error('Photos must be 5 MB or smaller after compression.');
  }

  return mimeType;
}

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 120);

  return cleaned || 'document';
}

function buildStoragePath(propertyId: string, fileName: string) {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  return `properties/${propertyId}/uploads/${timestamp}-${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}

function buildThumbnailPath(propertyId: string, filePath: string) {
  const fileName = filePath.split('/').pop() || 'photo.jpg';
  return `properties/${propertyId}/thumbnails/${fileName.replace(/\.[^.]+$/, '')}-thumb.jpg`;
}

function cleanLinkInput(input: DocumentLinkInput) {
  return {
    room_id: nullableString(input.room_id),
    utility_id: nullableString(input.utility_id),
    asset_id: nullableString(input.asset_id),
    reminder_id: nullableString(input.reminder_id),
    repair_id: nullableString(input.repair_id),
    service_record_id: nullableString(input.service_record_id),
    issue_id: nullableString(input.issue_id),
    trend_flag_id: nullableString(input.trend_flag_id),
    automation_device_id: nullableString(input.automation_device_id),
    tenancy_id: nullableString(input.tenancy_id),
    condition_report_id: nullableString(input.condition_report_id),
    compliance_obligation_id: nullableString(input.compliance_obligation_id)
  };
}

function cleanLinkUpdateInput(input: Partial<DocumentLinkInput>) {
  const payload: Record<string, string | null> = {};

  for (const field of DOCUMENT_LINK_FIELDS) {
    const value = input[field];
    if (value !== undefined) {
      payload[field] = nullableString(value);
    }
  }

  // A photo that is no longer filed against a condition report cannot stay
  // pinned to one of that report's entries.
  if (payload.condition_report_id === null) {
    payload.condition_report_entry_id = null;
  }

  return payload;
}

export function formatFileSize(bytes: number | null) {
  if (!bytes || bytes <= 0) {
    return 'Unknown size';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getDemoDocuments() {
  return [] as DocumentRow[];
}

export async function getDocumentDataContext(): Promise<DocumentDataContext> {
  const supabaseConfigured = isSupabaseConfigured();

  if (!supabaseConfigured) {
    return {
      mode: 'demo',
      supabaseConfigured,
      user: null,
      property: null
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return {
      mode: 'demo',
      supabaseConfigured,
      user: null,
      property: null
    };
  }

  return {
    mode: 'supabase',
    supabaseConfigured,
    user,
    property: await getPrimaryPropertyForUser(user.id)
  };
}

export async function getDocumentsForProperty(propertyId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_SELECT)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatDocumentError('load documents', error.message));
  }

  return sortDocuments(((data ?? []) as Partial<DocumentRow>[]).map(normalizeDocument));
}

export async function getDocumentsForContext(context: DocumentDataContext) {
  if (context.mode === 'demo') {
    return getDemoDocuments();
  }

  if (!context.property) {
    return [] as DocumentRow[];
  }

  return getDocumentsForProperty(context.property.id);
}

export async function getDocumentsForLink(context: DocumentDataContext, target: DocumentLinkTarget) {
  if (context.mode === 'demo') {
    return getDemoDocuments();
  }

  if (!context.property) {
    return [] as DocumentRow[];
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_SELECT)
    .eq('property_id', context.property.id)
    .eq(target.field, target.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatDocumentError('load linked documents', error.message));
  }

  return sortDocuments(((data ?? []) as Partial<DocumentRow>[]).map(normalizeDocument));
}

export async function uploadDocumentForContext(context: DocumentDataContext, input: DocumentUploadInput) {
  if (context.mode === 'demo') {
    throw new Error('Sign in to upload private files. Demo mode does not persist documents.');
  }

  if (!context.user || !context.property) {
    throw new Error('Create or select a property before uploading documents.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const title = input.title.trim();
  if (!title) {
    throw new Error('Document title is required.');
  }

  // Near-zero-cost pipeline: photos are resized/re-encoded in the browser and a
  // small thumbnail is generated so lists never fetch full-size images.
  const prepared = await prepareImageForUpload(input.file);
  const mimeType = validateFile(prepared.file);
  const filePath = buildStoragePath(context.property.id, prepared.file.name);
  await ensureProfileForUser(context.user);

  const { error: uploadError } = await supabase.storage
    .from(HOME_DOCUMENTS_BUCKET)
    .upload(filePath, prepared.file, {
      cacheControl: '3600',
      contentType: mimeType,
      upsert: false
    });

  if (uploadError) {
    throw new Error(formatDocumentError('upload document file', uploadError.message));
  }

  // Thumbnail upload is best-effort — a missing thumbnail must never fail the upload.
  let thumbnailPath: string | null = null;
  if (prepared.thumbnail) {
    const candidateThumbnailPath = buildThumbnailPath(context.property.id, filePath);
    const { error: thumbnailError } = await supabase.storage
      .from(HOME_DOCUMENTS_BUCKET)
      .upload(candidateThumbnailPath, prepared.thumbnail, {
        cacheControl: '31536000',
        contentType: 'image/jpeg',
        upsert: false
      });

    if (!thumbnailError) {
      thumbnailPath = candidateThumbnailPath;
    }
  }

  const { data, error: insertError } = await supabase
    .from('documents')
    .insert({
      property_id: context.property.id,
      ...cleanLinkInput(input),
      document_type: input.document_type || 'other',
      title,
      description: nullableString(input.description),
      file_name: prepared.file.name,
      file_path: filePath,
      thumbnail_path: thumbnailPath,
      bucket_name: HOME_DOCUMENTS_BUCKET,
      mime_type: mimeType,
      file_size_bytes: prepared.file.size,
      visibility: visibilityFromContexts(input.visibility_contexts, input.visibility || 'private'),
      visibility_contexts: normalizeVisibilityContexts(input.visibility_contexts, input.visibility || 'private'),
      source: 'manual_upload' satisfies DocumentSource,
      created_by: context.user.id
    })
    .select(DOCUMENT_SELECT)
    .single();

  if (insertError) {
    throw new Error(formatDocumentError('save document metadata', insertError.message));
  }

  return normalizeDocument(data as Partial<DocumentRow>);
}

export async function updateDocumentMetadataForContext(
  context: DocumentDataContext,
  documentId: string,
  input: DocumentMetadataInput
) {
  if (context.mode === 'demo') {
    throw new Error('Sign in to edit document metadata. Demo mode does not persist documents.');
  }

  if (!context.property) {
    throw new Error('Create or select a property before editing documents.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) {
      throw new Error('Document title is required.');
    }

    payload.title = title;
  }
  if (input.description !== undefined) payload.description = nullableString(input.description);
  if (input.document_type !== undefined) payload.document_type = input.document_type;
  if (input.visibility_contexts !== undefined) {
    const visibilityContexts = normalizeVisibilityContexts(input.visibility_contexts, input.visibility);
    payload.visibility_contexts = visibilityContexts;
    payload.visibility = visibilityFromContexts(visibilityContexts);
  } else if (input.visibility !== undefined) {
    payload.visibility = input.visibility;
    payload.visibility_contexts = normalizeVisibilityContexts(undefined, input.visibility);
  }

  Object.assign(payload, cleanLinkUpdateInput(input));

  const { data, error } = await supabase
    .from('documents')
    .update(payload)
    .eq('id', documentId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .select(DOCUMENT_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(formatDocumentError('update document metadata', error.message));
  }

  return data ? normalizeDocument(data as Partial<DocumentRow>) : null;
}

export async function deleteDocumentForContext(context: DocumentDataContext, documentId: string) {
  if (context.mode === 'demo') {
    throw new Error('Sign in to delete document metadata. Demo mode does not persist documents.');
  }

  if (!context.property) {
    throw new Error('Create or select a property before deleting documents.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  // Look up storage paths first so the underlying files can be freed (cost hygiene).
  const { data: existing } = await supabase
    .from('documents')
    .select('file_path, thumbnail_path')
    .eq('id', documentId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .maybeSingle();

  const { error } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null);

  if (error) {
    throw new Error(formatDocumentError('delete document metadata', error.message));
  }

  // Best-effort file removal — the metadata delete above is the source of truth,
  // so a storage hiccup here should not surface as a failed delete.
  const pathsToRemove = [existing?.file_path, existing?.thumbnail_path].filter(
    (path): path is string => typeof path === 'string' && path.length > 0
  );

  if (pathsToRemove.length > 0) {
    await supabase.storage.from(HOME_DOCUMENTS_BUCKET).remove(pathsToRemove);
  }
}

export async function createDocumentSignedUrlForContext(
  context: DocumentDataContext,
  documentId: string,
  expiresInSeconds = 120
) {
  if (context.mode === 'demo') {
    throw new Error('Sign in to open private documents.');
  }

  if (!context.property) {
    throw new Error('Create or select a property before opening documents.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data: document, error: metadataError } = await supabase
    .from('documents')
    .select(DOCUMENT_SELECT)
    .eq('id', documentId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (metadataError) {
    throw new Error(formatDocumentError('load document metadata', metadataError.message));
  }

  if (!document) {
    throw new Error('Document not found.');
  }

  const normalized = normalizeDocument(document as Partial<DocumentRow>);
  const { data, error } = await supabase.storage
    .from(normalized.bucket_name)
    .createSignedUrl(normalized.file_path, expiresInSeconds, {
      download: sanitizeFileName(normalized.file_name)
    });

  if (error || !data?.signedUrl) {
    throw new Error(formatDocumentError('create signed document link', error?.message));
  }

  return {
    document: normalized,
    signedUrl: data.signedUrl
  };
}

/**
 * Batch signed URLs for document thumbnails (one request for the whole list).
 * Thumbnails are ~15 KB JPEGs, so lists stay fast and egress stays near zero.
 * Documents without a thumbnail are simply absent from the returned map.
 */
export async function createDocumentThumbnailUrlsForContext(
  context: DocumentDataContext,
  documents: DocumentRow[],
  expiresInSeconds = 3600
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();

  if (context.mode === 'demo' || !context.property) {
    return urls;
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return urls;
  }

  const withThumbnails = documents.filter(
    (document) => document.thumbnail_path && !document.deleted_at
  );

  if (withThumbnails.length === 0) {
    return urls;
  }

  const { data, error } = await supabase.storage
    .from(HOME_DOCUMENTS_BUCKET)
    .createSignedUrls(
      withThumbnails.map((document) => document.thumbnail_path as string),
      expiresInSeconds
    );

  if (error || !data) {
    return urls;
  }

  data.forEach((entry, index) => {
    if (entry.signedUrl && !entry.error) {
      urls.set(withThumbnails[index].id, entry.signedUrl);
    }
  });

  return urls;
}
