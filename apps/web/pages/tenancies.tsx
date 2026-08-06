import { useEffect, useState } from 'react';
import { TENANCY_STATUSES, formatCalendarDate, formatEnumLabel, type TenancyStatus } from '@home-folder/shared';
import { Button, Card, ConfirmDialog, EmptyState, PageHeader, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { ViewOnlyNotice } from '../components/ViewOnlyNotice';
import { usePropertyAccess } from '../lib/access';
import { formatCentsAsCurrency } from '../lib/conditionReports';
import { resolveDataContext, type ResolvedDataContext } from '../lib/dataContext';
import {
  createTenancy,
  listTenancies,
  softDeleteTenancy,
  updateTenancy,
  type TenancyRow
} from '../lib/tenancies';

const fieldStyle = {
  padding: 10,
  borderRadius: 4,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)'
};

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  return formatCalendarDate(value) || value;
}

/** Dollars typed in the UI → integer cents for the DB (never floats). */
function dollarsToCents(value: string): number | null | 'invalid' {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 'invalid';
  }

  return Math.round(parsed * 100);
}

function centsToDollarsField(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2);
}

export default function TenanciesPage() {
  const access = usePropertyAccess();
  const [context, setContext] = useState<ResolvedDataContext | null>(null);
  const [tenancies, setTenancies] = useState<TenancyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Two-step deletion: the Delete button only opens a ConfirmDialog; nothing is
  // removed until the dialog is confirmed. window.confirm proved unreliable
  // (a suppressed dialog returns false and the click dies silently).
  const [tenancyDeleteTarget, setTenancyDeleteTarget] = useState<TenancyRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [tenantNames, setTenantNames] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [depositDollars, setDepositDollars] = useState('');
  const [status, setStatus] = useState<TenancyStatus>('active');
  const [depositReturnedOn, setDepositReturnedOn] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setLoadError('');

      try {
        const nextContext = await resolveDataContext();
        let nextTenancies: TenancyRow[] = [];

        if (nextContext.mode === 'supabase' && nextContext.property) {
          nextTenancies = await listTenancies(nextContext.property.id);
        }

        if (!isMounted) return;
        setContext(nextContext);
        setTenancies(nextTenancies);
      } catch (loadErr) {
        if (isMounted) {
          setLoadError(loadErr instanceof Error ? loadErr.message : 'Failed to load tenancies.');
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

  const resetForm = () => {
    setEditingId(null);
    setLabel('');
    setTenantNames('');
    setStartDate('');
    setEndDate('');
    setDepositDollars('');
    setStatus('active');
    setDepositReturnedOn('');
    setNotes('');
  };

  const startEditing = (tenancy: TenancyRow) => {
    setEditingId(tenancy.id);
    setLabel(tenancy.label);
    setTenantNames(tenancy.tenant_names || '');
    setStartDate(tenancy.start_date || '');
    setEndDate(tenancy.end_date || '');
    setDepositDollars(centsToDollarsField(tenancy.deposit_amount_cents));
    setStatus(tenancy.status);
    setDepositReturnedOn(tenancy.deposit_returned_on || '');
    setNotes(tenancy.notes || '');
    setFormError('');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0 });
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (!context?.property) {
      setFormError('Tenancy data is still loading.');
      return;
    }

    if (!label.trim()) {
      setFormError('A tenancy label is required (for example "Unit A — 2026 lease").');
      return;
    }

    const cents = dollarsToCents(depositDollars);
    if (cents === 'invalid') {
      setFormError('Deposit must be a valid dollar amount of zero or more.');
      return;
    }

    if (startDate && endDate && endDate < startDate) {
      setFormError('The end date cannot be before the start date.');
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const updated = await updateTenancy(editingId, {
          label,
          tenant_names: tenantNames || null,
          start_date: startDate || null,
          end_date: endDate || null,
          deposit_amount_cents: cents,
          deposit_returned_on: depositReturnedOn || null,
          status,
          notes: notes || null
        });
        setTenancies((current) => current.map((tenancy) => (tenancy.id === updated.id ? updated : tenancy)));
      } else {
        const created = await createTenancy({
          property_id: context.property.id,
          label,
          tenant_names: tenantNames || null,
          start_date: startDate || null,
          end_date: endDate || null,
          deposit_amount_cents: cents,
          deposit_returned_on: depositReturnedOn || null,
          status,
          notes: notes || null
        });
        setTenancies((current) => [created, ...current]);
      }

      resetForm();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to save tenancy.');
    } finally {
      setSaving(false);
    }
  };

  const requestDeleteTenancy = (tenancy: TenancyRow) => {
    setFormError('');
    setTenancyDeleteTarget(tenancy);
  };

  const cancelDeleteTenancy = () => {
    if (deletingId !== null) {
      return;
    }
    setTenancyDeleteTarget(null);
  };

  const handleConfirmDeleteTenancy = async () => {
    if (!tenancyDeleteTarget || deletingId !== null) {
      return;
    }

    const tenancyId = tenancyDeleteTarget.id;

    setDeletingId(tenancyId);
    setFormError('');

    try {
      await softDeleteTenancy(tenancyId);
      setTenancies((current) => current.filter((tenancy) => tenancy.id !== tenancyId));
      if (editingId === tenancyId) {
        resetForm();
      }
      setTenancyDeleteTarget(null);
    } catch (deleteError) {
      // Close the dialog so the error is readable on the page.
      setTenancyDeleteTarget(null);
      setFormError(deleteError instanceof Error ? deleteError.message : 'Failed to delete tenancy.');
    } finally {
      setDeletingId(null);
    }
  };

  const isSupabase = context?.mode === 'supabase';

  if (!loading && context && !isSupabase) {
    return (
      <>
        <PageHeader
          title="Tenancies"
          description="Who held the unit when, and the deposit at stake."
        />
        <Card>
          <h2 style={{ marginTop: 0 }}>Tenancy records need an account</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Tenancies, deposits, and condition evidence are saved to your account only — demo mode
            does not keep landlord records in this browser. Sign in and create a property to begin
            the record.
          </p>
          <ActionLink href="/sign-in">Sign in</ActionLink>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Tenancies"
        description="Who held the unit when, and the deposit at stake."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <UtilityBadge label={`${tenancies.length} tenanc${tenancies.length === 1 ? 'y' : 'ies'}`} />
            {context?.property ? <UtilityBadge label={context.property.nickname} /> : null}
          </div>
          <p style={{ margin: 0, color: 'var(--status-good)' }}>Saved to your account.</p>
          {loading ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--text-muted)' }}>Loading tenancies...</p>
          ) : null}
          {loadError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>{loadError}</p>
          ) : null}
          {isSupabase && !context?.property ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--text-muted)' }}>
              Create a property before adding tenancies.
            </p>
          ) : null}
          {formError ? (
            <div style={{ marginTop: 12, background: 'rgba(163,78,51,0.08)', color: 'var(--status-urgent)', border: '1px solid rgba(163,78,51,0.30)', borderRadius: 8, padding: 10 }}>
              {formError}
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit tenancy' : 'Add tenancy'}</h2>
          {!access.loading && !access.canWrite ? (
            <ViewOnlyNotice role={access.role} action="add or change tenancies" inline />
          ) : (
          <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Label</span>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={'Unit A — 2026 lease'}
                style={fieldStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Tenant names</span>
              <input
                value={tenantNames}
                onChange={(event) => setTenantNames(event.target.value)}
                placeholder="As written on the lease"
                style={fieldStyle}
              />
            </label>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Start date</span>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>End date</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as TenancyStatus)} style={fieldStyle}>
                  {TENANCY_STATUSES.map((value) => (
                    <option key={value} value={value}>{formatEnumLabel(value)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Security deposit (dollars)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={depositDollars}
                  onChange={(event) => setDepositDollars(event.target.value)}
                  placeholder="2400.00"
                  style={fieldStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Deposit returned on</span>
                <input
                  type="date"
                  value={depositReturnedOn}
                  onChange={(event) => setDepositReturnedOn(event.target.value)}
                  style={fieldStyle}
                />
              </label>
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Notes</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} style={{ ...fieldStyle, minHeight: 70 }} />
            </label>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button type="submit" disabled={saving || !context?.property}>
                {saving ? 'Saving tenancy...' : editingId ? 'Save changes' : 'Save tenancy'}
              </Button>
              {editingId ? (
                <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>
                  Cancel editing
                </Button>
              ) : null}
            </div>
          </form>
          )}
        </Card>

        {!loading && tenancies.length === 0 ? (
          <EmptyState
            title="No tenancies yet"
            description="Add each lease as a tenancy — the label, tenants, dates, and the deposit — so condition reports and the deposit packet have something to attach to."
          />
        ) : null}

        {tenancies.length > 0 ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Tenancies ({tenancies.length})</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {tenancies.map((tenancy) => {
                const deposit = formatCentsAsCurrency(tenancy.deposit_amount_cents, tenancy.deposit_currency);

                return (
                  <div key={tenancy.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
                      <div>
                        <h3 style={{ margin: '0 0 8px 0' }}>{tenancy.label}</h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          <UtilityBadge label={formatEnumLabel(tenancy.status)} />
                          {tenancy.deposit_returned_on ? <UtilityBadge label="Deposit returned" /> : null}
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '1.15rem',
                            fontWeight: 700,
                            marginBottom: 8
                          }}
                        >
                          {deposit ? `Deposit ${deposit}` : 'No deposit recorded'}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'grid', gap: 4 }}>
                          {tenancy.tenant_names && <div><strong>Tenants:</strong> {tenancy.tenant_names}</div>}
                          <div><strong>Term:</strong> {formatDate(tenancy.start_date)} — {formatDate(tenancy.end_date)}</div>
                          {tenancy.deposit_returned_on && (
                            <div><strong>Deposit returned:</strong> {formatDate(tenancy.deposit_returned_on)}</div>
                          )}
                          {tenancy.notes && <div><strong>Notes:</strong> {tenancy.notes}</div>}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: 8, minWidth: 160 }}>
                        <ActionLink href="/condition-reports" variant="secondary">Condition reports</ActionLink>
                        {access.loading || access.canWrite ? (
                        <>
                        <Button type="button" variant="secondary" onClick={() => startEditing(tenancy)}>
                          Edit
                        </Button>
                        <button
                          type="button"
                          onClick={() => requestDeleteTenancy(tenancy)}
                          disabled={deletingId === tenancy.id}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px solid rgba(163,78,51,0.30)',
                            background: 'rgba(163,78,51,0.08)',
                            color: 'var(--status-urgent)',
                            cursor: deletingId === tenancy.id ? 'not-allowed' : 'pointer',
                            opacity: deletingId === tenancy.id ? 0.7 : 1
                          }}
                        >
                          {deletingId === tenancy.id ? 'Deleting...' : 'Delete'}
                        </button>
                        </>
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

      <ConfirmDialog
        open={tenancyDeleteTarget !== null}
        title={tenancyDeleteTarget ? `Delete ${tenancyDeleteTarget.label}?` : 'Delete tenancy?'}
        description="Condition reports linked to it will remain, unlinked."
        confirmLabel="Delete tenancy"
        cancelLabel="Keep tenancy"
        busy={deletingId !== null && deletingId === tenancyDeleteTarget?.id}
        onConfirm={handleConfirmDeleteTenancy}
        onCancel={cancelDeleteTenancy}
      />
    </>
  );
}
