import {
  VISIBILITY_CONTEXTS,
  type DocumentVisibility,
  type VisibilityContext,
  type VisibilityOption
} from '@home-bible/shared';

export const DEFAULT_VISIBILITY_CONTEXTS: VisibilityContext[] = ['personal_archive'];

const contextLabels: Record<VisibilityContext, string> = {
  family: 'Family',
  buyer: 'Buyer',
  maintenance: 'Maintenance',
  insurance: 'Insurance',
  personal_archive: 'Personal Archive'
};

const legacyVisibilityToContexts: Record<string, VisibilityContext[]> = {
  private: ['personal_archive'],
  family: ['family'],
  maintenance: ['maintenance'],
  buyer_report: ['buyer'],
  buyer: ['buyer'],
  insurance: ['insurance'],
  personal_archive: ['personal_archive']
};

function isVisibilityContext(value: unknown): value is VisibilityContext {
  return typeof value === 'string' && (VISIBILITY_CONTEXTS as readonly string[]).includes(value);
}

export function normalizeVisibilityContexts(
  value: unknown,
  legacyVisibility?: string | null
): VisibilityContext[] {
  const selected = Array.isArray(value)
    ? value.filter(isVisibilityContext)
    : typeof value === 'string'
      ? value.split(',').map((item) => item.trim()).filter(isVisibilityContext)
      : [];

  if (selected.length > 0) {
    return Array.from(new Set(selected));
  }

  if (legacyVisibility && legacyVisibilityToContexts[legacyVisibility]) {
    return legacyVisibilityToContexts[legacyVisibility];
  }

  return DEFAULT_VISIBILITY_CONTEXTS;
}

export function visibilityFromContexts(
  contexts: VisibilityContext[] | undefined,
  fallback: VisibilityOption | DocumentVisibility = 'private'
): VisibilityOption | DocumentVisibility {
  const normalized = normalizeVisibilityContexts(contexts, fallback);

  if (normalized.includes('buyer')) return 'buyer_report';
  if (normalized.includes('maintenance')) return 'maintenance';
  if (normalized.includes('family')) return 'family';
  return 'private';
}

export function formatVisibilityContextLabel(context: VisibilityContext) {
  return contextLabels[context];
}

export function formatVisibilityContextList(contexts: VisibilityContext[]) {
  return normalizeVisibilityContexts(contexts)
    .map(formatVisibilityContextLabel)
    .join(', ');
}
