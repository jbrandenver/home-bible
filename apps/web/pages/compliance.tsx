import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import {
  COMPLIANCE_OBLIGATION_TYPES,
  formatEnumLabel,
  safeHttpUrl,
  toLocalDateString,
  type ComplianceObligationType
} from '@home-folder/shared';
import { Button, Card, PageHeader, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { ViewOnlyNotice } from '../components/ViewOnlyNotice';
import { usePropertyAccess } from '../lib/access';
import { resolveDataContext, type ResolvedDataContext } from '../lib/dataContext';
import {
  advanceNextDue,
  createComplianceObligation,
  listComplianceObligations,
  markObligationCompleted,
  obligationStatus,
  softDeleteComplianceObligation,
  updateComplianceObligation,
  DUE_SOON_DAYS,
  type ComplianceObligationRow,
  type ObligationStatus
} from '../lib/compliance';
import { COMPLIANCE_TEMPLATES, type ComplianceTemplate } from '../lib/complianceTemplates';

const fieldStyle: CSSProperties = {
  padding: 10,
  borderRadius: 'var(--radius-control)',
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)',
  fontSize: 16
};

const STATUS_ORDER: ObligationStatus[] = ['overdue', 'due_soon', 'scheduled', 'no_date'];

const STATUS_LABELS: Record<ObligationStatus, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  scheduled: 'Scheduled',
  no_date: 'No date set'
};

const STATUS_TONES: Record<ObligationStatus, 'urgent' | 'attention' | 'good' | 'neutral'> = {
  overdue: 'urgent',
  due_soon: 'attention',
  scheduled: 'good',
  no_date: 'neutral'
};

const DAY_MS = 24 * 60 * 60 * 1000;

type ObligationDraft = {
  title: string;
  authority: string;
  jurisdiction: string;
  obligation_type: ComplianceObligationType;
  frequency_months: string;
  next_due: string;
  last_completed_on: string;
  retention_years: string;
  reference_url: string;
  notes: string;
};

const EMPTY_DRAFT: ObligationDraft = {
  title: '',
  authority: '',
  jurisdiction: '',
  obligation_type: 'other',
  frequency_months: '',
  next_due: '',
  last_completed_on: '',
  retention_years: '',
  reference_url: '',
  notes: ''
};

function draftFields(draft: ObligationDraft) {
  return {
    title: draft.title,
    authority: draft.authority || null,
    jurisdiction: draft.jurisdiction || null,
    obligation_type: draft.obligation_type,
    frequency_months: draft.frequency_months ? Number(draft.frequency_months) : null,
    next_due: draft.next_due || null,
    last_completed_on: draft.last_completed_on || null,
    retention_years: draft.retention_years ? Number(draft.retention_years) : null,
    reference_url: draft.reference_url || null,
    notes: draft.notes || null
  };
}

function obligationToDraft(obligation: ComplianceObligationRow): ObligationDraft {
  return {
    title: obligation.title,
    authority: obligation.authority || '',
    jurisdiction: obligation.jurisdiction || '',
    obligation_type: obligation.obligation_type,
    frequency_months: obligation.frequency_months !== null ? String(obligation.frequency_months) : '',
    next_due: obligation.next_due || '',
    last_completed_on: obligation.last_completed_on || '',
    retention_years: obligation.retention_years !== null ? String(obligation.retention_years) : '',
    reference_url: obligation.reference_url || '',
    notes: obligation.notes || ''
  };
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / DAY_MS);
}

function frequencyLabel(frequencyMonths: number | null): string {
  if (!frequencyMonths) {
    return 'One-time / event-driven';
  }

  if (frequencyMonths === 12) {
    return 'Every year';
  }

  if (frequencyMonths % 12 === 0) {
    return `Every ${frequencyMonths / 12} years`;
  }

  return frequencyMonths === 1 ? 'Every month' : `Every ${frequencyMonths} months`;
}

function ObligationFormFields({
  draft,
  onChange,
  idPrefix,
  titleInputRef
}: {
  draft: ObligationDraft;
  onChange: (next: ObligationDraft) => void;
  idPrefix: string;
  titleInputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const set = (patch: Partial<ObligationDraft>) => onChange({ ...draft, ...patch });

  return (
    <>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Title (required)</span>
          <input
            ref={titleInputRef}
            id={`${idPrefix}-title`}
            value={draft.title}
            onChange={(event) => set({ title: event.target.value })}
            required
            style={fieldStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Authority</span>
          <input
            id={`${idPrefix}-authority`}
            value={draft.authority}
            onChange={(event) => set({ authority: event.target.value })}
            placeholder="e.g. City housing department"
            style={fieldStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Jurisdiction</span>
          <input
            id={`${idPrefix}-jurisdiction`}
            value={draft.jurisdiction}
            onChange={(event) => set({ jurisdiction: event.target.value })}
            placeholder="e.g. Seattle, WA"
            style={fieldStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Type</span>
          <select
            id={`${idPrefix}-type`}
            value={draft.obligation_type}
            onChange={(event) => set({ obligation_type: event.target.value as ComplianceObligationType })}
            style={fieldStyle}
          >
            {COMPLIANCE_OBLIGATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatEnumLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Repeats every (months)</span>
          <input
            id={`${idPrefix}-frequency`}
            type="number"
            min={1}
            max={240}
            value={draft.frequency_months}
            onChange={(event) => set({ frequency_months: event.target.value })}
            placeholder="Blank = one-time"
            style={fieldStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Next due</span>
          <input
            id={`${idPrefix}-next-due`}
            type="date"
            value={draft.next_due}
            onChange={(event) => set({ next_due: event.target.value })}
            style={fieldStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Last completed on</span>
          <input
            id={`${idPrefix}-last-completed`}
            type="date"
            value={draft.last_completed_on}
            onChange={(event) => set({ last_completed_on: event.target.value })}
            style={fieldStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Keep records (years)</span>
          <input
            id={`${idPrefix}-retention`}
            type="number"
            min={0}
            max={100}
            value={draft.retention_years}
            onChange={(event) => set({ retention_years: event.target.value })}
            style={fieldStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Official reference URL</span>
          <input
            id={`${idPrefix}-reference`}
            type="url"
            value={draft.reference_url}
            onChange={(event) => set({ reference_url: event.target.value })}
            placeholder="https://"
            style={fieldStyle}
          />
        </label>
      </div>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 600 }}>Notes</span>
        <textarea
          id={`${idPrefix}-notes`}
          value={draft.notes}
          onChange={(event) => set({ notes: event.target.value })}
          rows={3}
          style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </label>
    </>
  );
}

export default function CompliancePage() {
  const access = usePropertyAccess();
  const [context, setContext] = useState<ResolvedDataContext | null>(null);
  const [obligations, setObligations] = useState<ComplianceObligationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [addDraft, setAddDraft] = useState<ObligationDraft>(EMPTY_DRAFT);
  const [savingNew, setSavingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ObligationDraft>(EMPTY_DRAFT);
  const [actingId, setActingId] = useState<string | null>(null);
  const [templateJurisdiction, setTemplateJurisdiction] = useState('all');

  const addFormRef = useRef<HTMLElement>(null);
  const addTitleRef = useRef<HTMLInputElement>(null);

  const todayIso = useMemo(() => toLocalDateString(), []);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const nextContext = await resolveDataContext();
        let nextObligations: ComplianceObligationRow[] = [];

        if (nextContext.mode === 'supabase' && nextContext.property) {
          nextObligations = await listComplianceObligations(nextContext.property.id);
        }

        if (!isMounted) {
          return;
        }

        setContext(nextContext);
        setObligations(nextObligations);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load compliance obligations.');
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

  const grouped = useMemo(() => {
    const groups: Record<ObligationStatus, ComplianceObligationRow[]> = {
      overdue: [],
      due_soon: [],
      scheduled: [],
      no_date: []
    };

    for (const obligation of obligations) {
      groups[obligationStatus(obligation.next_due, todayIso)].push(obligation);
    }

    return groups;
  }, [obligations, todayIso]);

  const templateJurisdictions = useMemo(() => {
    const seen: string[] = [];
    for (const template of COMPLIANCE_TEMPLATES) {
      if (!seen.includes(template.jurisdiction)) {
        seen.push(template.jurisdiction);
      }
    }
    return seen;
  }, []);

  const visibleTemplates = useMemo(
    () =>
      templateJurisdiction === 'all'
        ? COMPLIANCE_TEMPLATES
        : COMPLIANCE_TEMPLATES.filter((template) => template.jurisdiction === templateJurisdiction),
    [templateJurisdiction]
  );

  const replaceObligation = (updated: ComplianceObligationRow) => {
    setObligations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const loadTemplate = (template: ComplianceTemplate) => {
    setAddDraft({
      title: template.title,
      authority: template.authority,
      jurisdiction: template.jurisdiction,
      obligation_type: template.obligation_type,
      frequency_months: template.frequency_months !== null ? String(template.frequency_months) : '',
      // A recurring template proposes a first due date one cycle out; a
      // one-time / event-driven template leaves it for the owner to decide.
      next_due: template.frequency_months !== null ? advanceNextDue(todayIso, template.frequency_months) : '',
      last_completed_on: '',
      retention_years: template.retention_years !== null ? String(template.retention_years) : '',
      reference_url: template.reference_url,
      notes: template.notes
    });
    setError('');
    setNotice(
      `Template loaded: ${template.title}. Review the details below, set the next due date, then save.`
    );
    addFormRef.current?.scrollIntoView();
    addTitleRef.current?.focus();
  };

  const submitNewObligation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!context?.property) {
      return;
    }

    setSavingNew(true);
    setError('');
    setNotice('');

    try {
      const created = await createComplianceObligation({
        property_id: context.property.id,
        ...draftFields(addDraft)
      });

      setObligations((current) => [...current, created]);
      setAddDraft(EMPTY_DRAFT);
      setNotice(`Saved "${created.title}".`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save the obligation.');
    } finally {
      setSavingNew(false);
    }
  };

  const startEditing = (obligation: ComplianceObligationRow) => {
    setEditingId(obligation.id);
    setEditDraft(obligationToDraft(obligation));
    setError('');
    setNotice('');
  };

  const saveEdits = async (obligationId: string) => {
    setActingId(obligationId);
    setError('');

    try {
      const updated = await updateComplianceObligation(obligationId, draftFields(editDraft));
      replaceObligation(updated);
      setEditingId(null);
      setNotice(`Updated "${updated.title}".`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update the obligation.');
    } finally {
      setActingId(null);
    }
  };

  const completeToday = async (obligation: ComplianceObligationRow) => {
    setActingId(obligation.id);
    setError('');
    setNotice('');

    try {
      const completedOn = toLocalDateString();
      const updated = await markObligationCompleted(
        obligation.id,
        completedOn,
        obligation.frequency_months,
        obligation.next_due
      );

      replaceObligation(updated);
      setNotice(
        updated.next_due
          ? `Marked "${updated.title}" completed today. Next due ${updated.next_due}.`
          : `Marked "${updated.title}" completed today.`
      );
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : 'Failed to mark the obligation completed.');
    } finally {
      setActingId(null);
    }
  };

  const removeObligation = async (obligation: ComplianceObligationRow) => {
    if (!window.confirm(`Remove "${obligation.title}"? Attached documents are kept.`)) {
      return;
    }

    setActingId(obligation.id);
    setError('');
    setNotice('');

    try {
      await softDeleteComplianceObligation(obligation.id);
      setObligations((current) => current.filter((item) => item.id !== obligation.id));
      setNotice(`Removed "${obligation.title}".`);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove the obligation.');
    } finally {
      setActingId(null);
    }
  };

  const renderObligationCard = (obligation: ComplianceObligationRow) => {
    const status = obligationStatus(obligation.next_due, todayIso);
    const isEditing = editingId === obligation.id;
    const isActing = actingId === obligation.id;
    const referenceUrl = safeHttpUrl(obligation.reference_url);
    const daysFromToday = obligation.next_due ? daysBetween(todayIso, obligation.next_due) : null;

    let dueDetail = '';
    if (status === 'overdue' && daysFromToday !== null) {
      dueDetail =
        daysFromToday === -1 ? 'was due yesterday' : `${Math.abs(daysFromToday)} days past due`;
    } else if (status === 'due_soon' && daysFromToday !== null) {
      dueDetail = daysFromToday === 0 ? 'due today' : `due in ${daysFromToday} day${daysFromToday === 1 ? '' : 's'}`;
    }

    return (
      <Card key={obligation.id}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 16, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: '0 0 8px 0' }}>{obligation.title}</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
              <UtilityBadge label={STATUS_LABELS[status]} tone={STATUS_TONES[status]} />
              <UtilityBadge label={formatEnumLabel(obligation.obligation_type)} />
              {obligation.retention_years !== null ? (
                <strong style={{ fontSize: '0.875rem' }}>
                  Keep records {obligation.retention_years} year{obligation.retention_years === 1 ? '' : 's'}
                </strong>
              ) : null}
            </div>
            {status === 'overdue' ? (
              <p style={{ margin: '0 0 8px 0', color: 'var(--status-urgent)', fontWeight: 700 }}>
                Overdue{dueDetail ? ` — ${dueDetail}` : ''}. Missed deadlines can block licenses or draw fines.
              </p>
            ) : null}

            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              {obligation.authority ? (
                <div>
                  <strong>Authority:</strong> {obligation.authority}
                </div>
              ) : null}
              {obligation.jurisdiction ? (
                <div>
                  <strong>Jurisdiction:</strong> {obligation.jurisdiction}
                </div>
              ) : null}
              <div>
                <strong>Next due:</strong>{' '}
                {obligation.next_due
                  ? `${obligation.next_due}${dueDetail && status !== 'overdue' ? ` (${dueDetail})` : ''}`
                  : 'No date set'}
              </div>
              <div>
                <strong>Last completed:</strong> {obligation.last_completed_on || 'Never recorded'}
              </div>
              <div>
                <strong>Frequency:</strong> {frequencyLabel(obligation.frequency_months)}
              </div>
              {referenceUrl ? (
                <div>
                  <a
                    href={referenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--color-brass-deep)', fontWeight: 600 }}
                  >
                    Official reference (opens in new tab)
                  </a>
                </div>
              ) : null}
              {obligation.notes ? <p style={{ margin: '8px 0 0 0' }}>{obligation.notes}</p> : null}
            </div>

            {isEditing ? (
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
                <h4 style={{ margin: 0 }}>Edit obligation</h4>
                <ObligationFormFields
                  draft={editDraft}
                  onChange={setEditDraft}
                  idPrefix={`edit-${obligation.id}`}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button type="button" onClick={() => saveEdits(obligation.id)} disabled={isActing}>
                    {isActing ? 'Saving...' : 'Save changes'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={isActing}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {!isEditing && (access.loading || access.canWrite) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button type="button" onClick={() => completeToday(obligation)} disabled={isActing}>
                {isActing ? 'Saving...' : 'Mark completed today'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => startEditing(obligation)} disabled={isActing}>
                Edit
              </Button>
              <Button type="button" variant="secondary" onClick={() => removeObligation(obligation)} disabled={isActing}>
                Remove
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
    );
  };

  const header = (
    <PageHeader
      title="Compliance"
      description="Registrations, licenses, inspections, and notices your rental must keep current — with deadlines, completion history, and the official source for each rule."
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <Card>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading compliance obligations...</p>
        </Card>
      </>
    );
  }

  if (!context || context.mode === 'demo') {
    return (
      <>
        {header}
        <Card>
          <h2 style={{ marginTop: 0 }}>Compliance tracking needs an account</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Compliance deadlines are real money — a missed renewal can block a rental license or draw
            fines — so this record is saved to your account rather than to demo storage in this browser.
            Sign in (or create a free account) and add a property to start tracking obligations.
          </p>
          <ActionLink href="/sign-in">Sign in</ActionLink>
        </Card>
      </>
    );
  }

  if (!context.property) {
    return (
      <>
        {header}
        <Card>
          <h2 style={{ marginTop: 0 }}>Create a property first</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Compliance obligations attach to a property. Create your first property and this page will
            track its deadlines.
          </p>
          <ActionLink href="/create-property">Create a property</ActionLink>
        </Card>
      </>
    );
  }

  return (
    <>
      {header}

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <UtilityBadge label={context.property.nickname} />
            <UtilityBadge label={`${obligations.length} obligation${obligations.length === 1 ? '' : 's'}`} />
            {grouped.overdue.length > 0 ? (
              <UtilityBadge label={`${grouped.overdue.length} overdue`} tone="urgent" />
            ) : null}
            {grouped.due_soon.length > 0 ? (
              <UtilityBadge label={`${grouped.due_soon.length} due soon`} tone="attention" />
            ) : null}
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
            This page keeps your rental&rsquo;s compliance record in one place: what each authority
            requires, when it is next due, when you last did it, and how long to keep the paperwork.
            Attach certificates from the Documents page. It is a tracking tool, not legal advice —
            rules change, so verify each obligation against its linked official source.
          </p>
          {error ? (
            <p style={{ marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }} role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p style={{ marginBottom: 0, color: 'var(--status-good)', fontWeight: 700 }} role="status">
              {notice}
            </p>
          ) : null}
        </Card>

        {obligations.length === 0 ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>No obligations tracked yet</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
              Start from a template below, or add a custom obligation for anything your jurisdiction
              requires.
            </p>
          </Card>
        ) : (
          STATUS_ORDER.map((status) => {
            const group = grouped[status];
            if (group.length === 0) {
              return null;
            }

            return (
              <section key={status} aria-label={`${STATUS_LABELS[status]} obligations`}>
                <h2 className="hb-leader" style={{ paddingBottom: 6, marginBottom: 16, marginTop: 0 }}>
                  {STATUS_LABELS[status]} ({group.length})
                  {status === 'due_soon' ? (
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {' '}
                      — within {DUE_SOON_DAYS} days
                    </span>
                  ) : null}
                </h2>
                <div style={{ display: 'grid', gap: 12 }}>{group.map(renderObligationCard)}</div>
              </section>
            );
          })
        )}

        <section aria-label="Add from template">
          <h2 className="hb-leader" style={{ paddingBottom: 6, marginBottom: 16, marginTop: 0 }}>
            Add from template
          </h2>
          <Card style={{ marginBottom: 12 }}>
            <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
              A starter catalog of common landlord obligations. It is not legal advice and not
              exhaustive — verify details against the official source linked on each template.
            </p>
            <label style={{ display: 'grid', gap: 6, maxWidth: 320 }}>
              <span style={{ fontWeight: 600 }}>Filter by jurisdiction</span>
              <select
                value={templateJurisdiction}
                onChange={(event) => setTemplateJurisdiction(event.target.value)}
                style={fieldStyle}
              >
                <option value="all">All jurisdictions</option>
                {templateJurisdictions.map((jurisdiction) => (
                  <option key={jurisdiction} value={jurisdiction}>
                    {jurisdiction}
                  </option>
                ))}
              </select>
            </label>
          </Card>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {visibleTemplates.map((template) => {
              const templateUrl = safeHttpUrl(template.reference_url);

              return (
                <Card key={template.id}>
                  <h3 style={{ marginTop: 0, marginBottom: 8 }}>{template.title}</h3>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
                    <UtilityBadge label={template.jurisdiction} />
                    <UtilityBadge label={formatEnumLabel(template.obligation_type)} />
                    {template.retention_years !== null ? (
                      <strong style={{ fontSize: '0.875rem' }}>
                        Keep records {template.retention_years} years
                      </strong>
                    ) : null}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                    <div>
                      <strong>Authority:</strong> {template.authority}
                    </div>
                    <div>
                      <strong>Frequency:</strong> {frequencyLabel(template.frequency_months)}
                    </div>
                    <p style={{ margin: '8px 0' }}>{template.notes}</p>
                    {templateUrl ? (
                      <a
                        href={templateUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--color-brass-deep)', fontWeight: 600 }}
                      >
                        Official reference (opens in new tab)
                      </a>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {access.loading || access.canWrite ? (
                    <Button type="button" onClick={() => loadTemplate(template)}>
                      Add to this property
                    </Button>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section aria-label="Add custom obligation" ref={addFormRef}>
          <h2 className="hb-leader" style={{ paddingBottom: 6, marginBottom: 16, marginTop: 0 }}>
            Add custom obligation
          </h2>
          <Card>
            {!access.loading && !access.canWrite ? (
              <ViewOnlyNotice role={access.role} action="add compliance obligations" inline />
            ) : (
            <form onSubmit={submitNewObligation} style={{ display: 'grid', gap: 12 }}>
              <ObligationFormFields
                draft={addDraft}
                onChange={setAddDraft}
                idPrefix="add"
                titleInputRef={addTitleRef}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button type="submit" disabled={savingNew}>
                  {savingNew ? 'Saving...' : 'Save obligation'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setAddDraft(EMPTY_DRAFT);
                    setNotice('');
                  }}
                  disabled={savingNew}
                >
                  Clear form
                </Button>
              </div>
            </form>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
