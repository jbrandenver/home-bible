import {
  DOCUMENT_SOURCES,
  DOCUMENT_TYPES,
  DOCUMENT_VISIBILITIES,
  type DocumentRow as SharedDocumentRow,
  type DocumentSource,
  type DocumentType,
  type DocumentVisibility,
  type VisibilityContext
} from '@home-bible/shared';
import type { User } from '@supabase/supabase-js';
import { ensureProfileForUser, getCurrentUser, getSupabaseSetupMessage, isSupabaseConfigured } from './auth';
import { getPrimaryPropertyForUser, type PropertySummary } from './properties';
import { getSupabaseBrowserClient } from './supabase/client';
import { normalizeVisibilityContexts, visibilityFromContexts } from './visibility';

export const HOME_DOCUMENTS_BUCKET = 'home-documents';
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
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
export type DocumentRow = SharedDocumentRow;

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
  | 'trend_flag_id';

export type DocumentLinkTarget = {
  field: DocumentLinkField;
  id: string;
};

const DOCUMENT_SELECT =
  'id, property_id, room_id, utility_id, asset_id, reminder_id, repair_id, service_record_id, issue_id, trend_flag_id, document_type, title, description, file_name, file_path, bucket_name, mime_type, file_size_bytes, visibility, visibility_contexts, source, created_by, created_at, updated_at, deleted_at';

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
    document_type: enumValue(DOCUMENT_TYPES, raw.document_type, 'other'),
    title: raw.title?.trim() || raw.file_name?.trim() || 'Untitled document',
    description: nullableString(raw.description),
    file_name: raw.file_name?.trim() || 'document',
    file_path: raw.file_path?.trim() || '',
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

  if (!needsMigration) {
    return detail;
  }

  return `Failed to ${action}. Apply ${PHASE_6I_MIGRATION} to your Supabase project, then try again. Original error: ${detail}`;
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

function cleanLinkInput(input: DocumentLinkInput) {
  return {
    room_id: nullableString(input.room_id),
    utility_id: nullableString(input.utility_id),
    asset_id: nullableString(input.asset_id),
    reminder_id: nullableString(input.reminder_id),
    repair_id: nullableString(input.repair_id),
    service_record_id: nullableString(input.service_record_id),
    issue_id: nullableString(input.issue_id),
    trend_flag_id: nullableString(input.trend_flag_id)
  };
}

function cleanLinkUpdateInput(input: Partial<DocumentLinkInput>) {
  const payload: Record<string, string | null> = {};

  if (input.room_id !== undefined) payload.room_id = nullableString(input.room_id);
  if (input.utility_id !== undefined) payload.utility_id = nullableString(input.utility_id);
  if (input.asset_id !== undefined) payload.asset_id = nullableString(input.asset_id);
  if (input.reminder_id !== undefined) payload.reminder_id = nullableString(input.reminder_id);
  if (input.repair_id !== undefined) payload.repair_id = nullableString(input.repair_id);
  if (input.service_record_id !== undefined) payload.service_record_id = nullableString(input.service_record_id);
  if (input.issue_id !== undefined) payload.issue_id = nullableString(input.issue_id);
  if (input.trend_flag_id !== undefined) payload.trend_flag_id = nullableString(input.trend_flag_id);

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

  const mimeType = validateFile(input.file);
  const filePath = buildStoragePath(context.property.id, input.file.name);
  await ensureProfileForUser(context.user);

  const { error: uploadError } = await supabase.storage
    .from(HOME_DOCUMENTS_BUCKET)
    .upload(filePath, input.file, {
      cacheControl: '3600',
      contentType: mimeType,
      upsert: false
    });

  if (uploadError) {
    throw new Error(formatDocumentError('upload document file', uploadError.message));
  }

  const { data, error: insertError } = await supabase
    .from('documents')
    .insert({
      property_id: context.property.id,
      ...cleanLinkInput(input),
      document_type: input.document_type || 'other',
      title,
      description: nullableString(input.description),
      file_name: input.file.name,
      file_path: filePath,
      bucket_name: HOME_DOCUMENTS_BUCKET,
      mime_type: mimeType,
      file_size_bytes: input.file.size,
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

  const { error } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId)
    .eq('property_id', context.property.id);

  if (error) {
    throw new Error(formatDocumentError('delete document metadata', error.message));
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
    .createSignedUrl(normalized.file_path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(formatDocumentError('create signed document link', error?.message));
  }

  return {
    document: normalized,
    signedUrl: data.signedUrl
  };
}
