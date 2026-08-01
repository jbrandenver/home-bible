import { useEffect, useState } from 'react';
import {
  CONDITION_REPORT_TYPES,
  formatCalendarDate,
  formatEnumLabel,
  toLocalDateString,
  type ConditionReportType
} from '@home-folder/shared';
import { Button, Card, EmptyState, PageHeader, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import {
  canModifyConditionReport,
  createConditionReport,
  listConditionReportCounts,
  listConditionReports,
  softDeleteConditionReport,
  type ConditionReportRow
} from '../../lib/conditionReports';
import { resolveDataContext, type ResolvedDataContext } from '../../lib/dataContext';
import { listTenancies, type TenancyRow } from '../../lib/tenancies';

const fieldStyle = {
  padding: 10,
  borderRadius: 4,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)'
};

const REPORT_TYPE_HINTS: Record<ConditionReportType, string> = {
  move_in: 'Before the tenancy begins — the baseline the deposit is judged against.',
  move_out: 'At move-out, before any repairs or cleaning — the as-left condition.',
  move_out_after_repairs: 'After repairs or cleaning are done — what the deductions paid for.',
  periodic: 'A mid-tenancy walkthrough for the record.'
};

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  return formatCalendarDate(value) || value;
}

export default function ConditionReportsPage() {
  const [context, setContext] = useState<ResolvedDataContext | null>(null);
  const [reports, setReports] = useState<ConditionReportRow[]>([]);
  const [tenancies, setTenancies] = useState<TenancyRow[]>([]);
  const [entryCounts, setEntryCounts] = useState<Record<string, number>>({});
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  const [reportType, setReportType] = useState<ConditionReportType>('move_in');
  const [reportDate, setReportDate] = useState(toLocalDateString());
  const [tenancyId, setTenancyId] = useState('');
  const [conductedBy, setConductedBy] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setLoadError('');

      try {
        const nextContext = await resolveDataContext();
        let nextReports: ConditionReportRow[] = [];
        let nextTenancies: TenancyRow[] = [];
        let nextEntryCounts: Record<string, number> = {};
        let nextPhotoCounts: Record<string, number> = {};

        if (nextContext.mode === 'supabase' && nextContext.property) {
          const [reportRows, tenancyRows, counts] = await Promise.all([
            listConditionReports(nextContext.property.id),
            listTenancies(nextContext.property.id),
            listConditionReportCounts(nextContext.property.id)
          ]);
          nextReports = reportRows;
          nextTenancies = tenancyRows;
          nextEntryCounts = counts.entryCounts;
          nextPhotoCounts = counts.photoCounts;
        }

        if (!isMounted) return;
        setContext(nextContext);
        setReports(nextReports);
        setTenancies(nextTenancies);
        setEntryCounts(nextEntryCounts);
        setPhotoCounts(nextPhotoCounts);
      } catch (loadErr) {
        if (isMounted) {
          setLoadError(loadErr instanceof Error ? loadErr.message : 'Failed to load condition reports.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const tenancyLabel = (id: string | null) => {
    if (!id) return null;
    return tenancies.find((tenancy) => tenancy.id === id)?.label || 'Tenancy record';
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (!context?.property) {
      setFormError('Condition report data is still loading.');
      return;
    }

    if (!reportDate) {
      setFormError('A report date is required.');
      return;
    }

    setSaving(true);

    try {
      const created = await createConditionReport({
        property_id: context.property.id,
        tenancy_id: tenancyId || null,
        report_type: reportType,
        report_date: reportDate,
        conducted_by: conductedBy || null
      });

      setReports((current) => [created, ...current]);
      setReportType('move_in');
      setReportDate(toLocalDateString());
      setTenancyId('');
      setConductedBy('');
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to create condition report.');
    } finally {
      setSaving(false);
    }
  };

  const removeReport = async (report: ConditionReportRow) => {
    setFormError('');

    const confirmed = window.confirm(
      'Remove this draft report? Its entries go with it, and any photos already taken stay in Documents. A completed report cannot be removed — once it is completed, its entries, photos, and timestamps are the deposit evidence.'
    );
    if (!confirmed) return;

    setDeletingReportId(report.id);

    try {
      await softDeleteConditionReport(report.id);
      setReports((current) => current.filter((row) => row.id !== report.id));
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : 'Failed to remove condition report.');
    } finally {
      setDeletingReportId(null);
    }
  };

  const isSupabase = context?.mode === 'supabase';

  if (!loading && context && !isSupabase) {
    return (
      <>
        <PageHeader
          title="Condition Reports"
          description="Timestamped move-in and move-out evidence, ready to print with the deposit statement."
        />
        <Card>
          <h2 style={{ marginTop: 0 }}>Condition evidence needs an account</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Condition reports and their photos are saved to your account only — demo mode does not
            keep landlord records in this browser. Sign in and create a property to begin the record.
          </p>
          <ActionLink href="/sign-in">Sign in</ActionLink>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Condition Reports"
        description="Timestamped move-in and move-out evidence, ready to print with the deposit statement."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <UtilityBadge label={`${reports.length} report${reports.length === 1 ? '' : 's'}`} />
            {context?.property ? <UtilityBadge label={context.property.nickname} /> : null}
          </div>
          <p style={{ margin: 0, color: 'var(--status-good)' }}>Saved to your account.</p>
          {loading ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--text-muted)' }}>Loading condition reports...</p>
          ) : null}
          {loadError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>{loadError}</p>
          ) : null}
          {isSupabase && !context?.property ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--text-muted)' }}>
              Create a property before adding condition reports.
            </p>
          ) : null}
          {formError ? (
            <div style={{ marginTop: 12, background: 'rgba(163,78,51,0.08)', color: 'var(--status-urgent)', border: '1px solid rgba(163,78,51,0.30)', borderRadius: 8, padding: 10 }}>
              {formError}
            </div>
          ) : null}
        </Card>

        <Card tone="dark">
          <h2 style={{ marginTop: 0 }}>The three moments that protect a deposit</h2>
          <p style={{ color: 'rgba(255,248,234,0.78)', marginTop: 0 }}>
            California&apos;s AB 2801 expects photographic condition evidence at three points, delivered
            with the itemized deduction statement:
          </p>
          <ol style={{ color: 'rgba(255,248,234,0.78)', margin: 0, paddingLeft: 22, display: 'grid', gap: 6 }}>
            <li><strong style={{ color: 'var(--text-inverse)' }}>Move-in</strong> — photos before the tenancy begins, the baseline.</li>
            <li><strong style={{ color: 'var(--text-inverse)' }}>Move-out</strong> — photos at move-out, before any repairs or cleaning.</li>
            <li><strong style={{ color: 'var(--text-inverse)' }}>After repairs</strong> — photos once the work the deductions paid for is done.</li>
          </ol>
          <p style={{ color: 'rgba(255,248,234,0.78)', marginBottom: 0 }}>
            Each report records its capture timestamps automatically; the detail page assembles them
            into a printable deposit packet.
          </p>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Start a report</h2>
          <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Report type</span>
                <select
                  value={reportType}
                  onChange={(event) => setReportType(event.target.value as ConditionReportType)}
                  style={fieldStyle}
                >
                  {CONDITION_REPORT_TYPES.map((type) => (
                    <option key={type} value={type}>{formatEnumLabel(type)}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Report date</span>
                <input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Tenancy (optional)</span>
                <select value={tenancyId} onChange={(event) => setTenancyId(event.target.value)} style={fieldStyle}>
                  <option value="">Not linked</option>
                  {tenancies.map((tenancy) => (
                    <option key={tenancy.id} value={tenancy.id}>{tenancy.label}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Conducted by</span>
                <input
                  value={conductedBy}
                  onChange={(event) => setConductedBy(event.target.value)}
                  placeholder="Who walked the unit"
                  style={fieldStyle}
                />
              </label>
            </div>

            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
              {REPORT_TYPE_HINTS[reportType]}
            </p>

            <div>
              <Button type="submit" disabled={saving || !context?.property}>
                {saving ? 'Creating report...' : 'Create report'}
              </Button>
            </div>
          </form>
          {tenancies.length === 0 && !loading ? (
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
              No tenancies yet — you can link one later, or <ActionLink href="/tenancies" variant="secondary">add a tenancy</ActionLink> first
              so the packet can show the deposit at stake.
            </p>
          ) : null}
        </Card>

        {!loading && reports.length === 0 ? (
          <EmptyState
            title="No condition reports yet"
            description="Start a move-in report before a tenancy begins. Every entry and photo is timestamped automatically as it is captured."
          />
        ) : null}

        {reports.length > 0 ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Reports ({reports.length})</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {reports.map((report) => {
                const linkedTenancy = tenancyLabel(report.tenancy_id);
                const entryCount = entryCounts[report.id] || 0;
                const photoCount = photoCounts[report.id] || 0;

                return (
                  <div key={report.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
                      <div>
                        <h3 style={{ margin: '0 0 8px 0' }}>
                          {formatEnumLabel(report.report_type)} — {formatDate(report.report_date)}
                        </h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          <UtilityBadge label={formatEnumLabel(report.status)} />
                          <UtilityBadge label={`${entryCount} entr${entryCount === 1 ? 'y' : 'ies'}`} />
                          <UtilityBadge label={`${photoCount} photo${photoCount === 1 ? '' : 's'}`} />
                          {linkedTenancy ? <UtilityBadge label={`Tenancy: ${linkedTenancy}`} /> : null}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'grid', gap: 4 }}>
                          {report.conducted_by && <div><strong>Conducted by:</strong> {report.conducted_by}</div>}
                          {report.completed_at && (
                            <div><strong>Completed:</strong> {new Date(report.completed_at).toLocaleString()}</div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: 8, minWidth: 140 }}>
                        <ActionLink href={`/condition-reports/${report.id}`} variant="secondary">Open</ActionLink>
                        {canModifyConditionReport(report.status) ? (
                          <button
                            type="button"
                            onClick={() => removeReport(report)}
                            disabled={deletingReportId === report.id}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 6,
                              border: '1px solid rgba(163,78,51,0.30)',
                              background: 'rgba(163,78,51,0.08)',
                              color: 'var(--status-urgent)',
                              cursor: deletingReportId === report.id ? 'not-allowed' : 'pointer',
                              fontWeight: 700,
                              opacity: deletingReportId === report.id ? 0.7 : 1
                            }}
                          >
                            {deletingReportId === report.id ? 'Removing...' : 'Remove draft'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
