import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { Button, Card, Input, PageHeader, getControlStyle } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { resolveDataContext, type ResolvedDataContext } from '../lib/dataContext';
import {
  ARCHIVE_RETENTION_DAYS,
  archiveDeleteDate,
  archivePropertyForOwner,
  createPropertyForUser,
  createUnitsForBuilding,
  deletePropertyForOwner,
  listPropertiesForUser,
  purgeExpiredArchivedProperties,
  restorePropertyForOwner,
  setActivePropertyId,
  type PropertySummary
} from '../lib/properties';
import {
  AGING_ASSET_YEARS,
  WARRANTY_HORIZON_DAYS,
  buildPortfolioOverview,
  loadPortfolioData,
  type PortfolioOverview
} from '../lib/portfolio';
import {
  FREE_PROPERTY_ALLOWANCE,
  evaluatePortfolioAccess,
  getPortfolioCheckoutUrl,
  hasPortfolioPlan,
  type PortfolioAccess
} from '../lib/entitlements';

const subtleText: CSSProperties = { color: 'var(--text-muted)' };

const fieldStyle: CSSProperties = {
  padding: 10,
  borderRadius: 'var(--radius-control)',
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)'
};

const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0
};

// A button that behaves like an in-record cross reference: it records the
// chosen property, then navigates. A button (not a link) because it changes
// app state before it moves.
const nameButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  fontWeight: 600,
  color: 'var(--color-brass-deep)',
  textDecoration: 'underline',
  cursor: 'pointer',
  textAlign: 'left'
};

const numberCellStyle: CSSProperties = {
  textAlign: 'right',
  padding: '10px 12px',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap'
};

const headCellStyle: CSSProperties = {
  textAlign: 'right',
  padding: '10px 12px',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.66rem',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border-subtle)'
};

function isBuilding(property: PropertySummary): boolean {
  return (
    !property.parent_property_id &&
    (property.property_type === 'apartment_building' || property.property_type === 'multi_family')
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'No date set';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysLeftLabel(daysLeft: number): string {
  if (daysLeft === 0) return 'Expires today';
  if (daysLeft === 1) return '1 day left';
  return `${daysLeft} days left`;
}

type UnitsResult = {
  buildingId: string;
  createdCount: number;
  failed: { label: string; message: string }[];
};

export default function PortfolioPage() {
  const router = useRouter();

  const [context, setContext] = useState<ResolvedDataContext | null>(null);
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [overview, setOverview] = useState<PortfolioOverview | null>(null);
  const [access, setAccess] = useState<PortfolioAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add-a-building form.
  const [showBuildingForm, setShowBuildingForm] = useState(false);
  const [buildingDraft, setBuildingDraft] = useState({ nickname: '', city: '', state: '' });
  const [creatingBuilding, setCreatingBuilding] = useState(false);
  const [buildingError, setBuildingError] = useState('');
  const [buildingNotice, setBuildingNotice] = useState('');

  // Archive / delete actions on a property row (launch QA 2026-08-03).
  const [archivedProperties, setArchivedProperties] = useState<PropertySummary[]>([]);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [manageError, setManageError] = useState('');
  const [manageNotice, setManageNotice] = useState('');

  // Add-units form (one open building at a time).
  const [unitsTargetId, setUnitsTargetId] = useState<string | null>(null);
  const [unitsDraft, setUnitsDraft] = useState('');
  const [creatingUnits, setCreatingUnits] = useState(false);
  const [unitsError, setUnitsError] = useState('');
  const [unitsResult, setUnitsResult] = useState<UnitsResult | null>(null);

  const load = useCallback(async () => {
    setError('');

    const nextContext = await resolveDataContext();

    if (nextContext.mode !== 'supabase' || !nextContext.user) {
      setContext(nextContext);
      setProperties([]);
      setOverview(null);
      setAccess(null);
      return;
    }

    // Archives past their retention window become deletions before anything
    // is listed — the promise is "restorable for a while", not forever.
    await purgeExpiredArchivedProperties(nextContext.user.id);

    const fullList = await listPropertiesForUser(nextContext.user.id);
    const list = fullList.filter((property) => !property.archived_at);
    const archivedList = fullList.filter((property) => Boolean(property.archived_at));
    const paymentsConfigured = Boolean(getPortfolioCheckoutUrl(null));
    const hasPlan = await hasPortfolioPlan();
    // Billing counts archived homes too: archiving sets a record aside, it
    // does not downgrade. Only deletion changes the count.
    //
    // Units are part of their building and do not consume the allowance, so
    // only top-level homes are counted — this must match the rule the database
    // enforces in enforce_property_allowance() (migration 035), or the UI would
    // block at a different point than the server does.
    const nextAccess = evaluatePortfolioAccess({
      hasPlan,
      paymentsConfigured,
      propertyCount: fullList.filter((property) => !property.parent_property_id).length
    });

    let nextOverview: PortfolioOverview | null = null;
    if (list.length >= 2) {
      const data = await loadPortfolioData(list.map((property) => property.id));
      nextOverview = buildPortfolioOverview(list, data, new Date().toISOString().slice(0, 10));
    }

    setContext(nextContext);
    setProperties(list);
    setArchivedProperties(archivedList.filter((property) => !property.parent_property_id));
    setAccess(nextAccess);
    setOverview(nextOverview);
  }, []);

  useEffect(() => {
    let isMounted = true;

    load()
      .catch((loadError) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load the portfolio.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [load]);

  const propertiesById = useMemo(
    () => new Map(properties.map((property) => [property.id, property])),
    [properties]
  );

  const propertyName = (propertyId: string) =>
    propertiesById.get(propertyId)?.nickname ?? 'Property no longer visible';

  const checkoutUrl = context?.user ? getPortfolioCheckoutUrl(context.user.id) : null;
  const addingLocked = Boolean(access?.requiresUpgradeToAdd);
  const paymentsConfigured = Boolean(access?.paymentsConfigured);

  // Archive: reversible for ARCHIVE_RETENTION_DAYS, billing unchanged.
  // Delete: typed-name confirmation, and the plan note — the downgrade takes
  // effect at the next billing cycle, never prorated.
  const archiveProperty = async (property: PropertySummary) => {
    if (!context?.user) return;
    const confirmed = window.confirm(
      `Archive "${property.nickname}"? It leaves your active homes and the switcher, but keeps every record and can be restored for ${ARCHIVE_RETENTION_DAYS} days. After that it is deleted automatically. Archiving does not change your plan.`
    );
    if (!confirmed) return;

    setManagingId(property.id);
    setManageError('');
    setManageNotice('');
    try {
      await archivePropertyForOwner(property.id, context.user.id);
      setManageNotice(`${property.nickname} archived — restorable for ${ARCHIVE_RETENTION_DAYS} days below.`);
      await load();
    } catch (actionError) {
      setManageError(actionError instanceof Error ? actionError.message : 'Failed to archive this home.');
    } finally {
      setManagingId(null);
    }
  };

  const deleteProperty = async (property: PropertySummary) => {
    if (!context?.user) return;

    const label = property.parent_property_id
      ? property.unit_label || property.nickname
      : property.nickname;

    const typed = window.prompt(
      `Deleting "${label}" removes everything recorded in it, forever. To confirm, type the name exactly:`
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== label.trim().toLowerCase()) {
      setManageError('The name did not match — nothing was deleted.');
      return;
    }

    const confirmed = window.confirm(
      `Last check: delete "${label}" permanently? ${property.parent_property_id ? '' : 'A building takes its units with it. '}If your plan is priced per home, the downgrade takes effect at your next billing cycle — nothing is prorated or refunded mid-cycle. This cannot be undone.`
    );
    if (!confirmed) return;

    setManagingId(property.id);
    setManageError('');
    setManageNotice('');
    try {
      await deletePropertyForOwner(property.id, context.user.id);
      setManageNotice(`${label} deleted. Any plan change begins at your next billing cycle.`);
      await load();
    } catch (actionError) {
      setManageError(actionError instanceof Error ? actionError.message : 'Failed to delete this home.');
    } finally {
      setManagingId(null);
    }
  };

  const restoreProperty = async (property: PropertySummary) => {
    if (!context?.user) return;
    setManagingId(property.id);
    setManageError('');
    setManageNotice('');
    try {
      await restorePropertyForOwner(property.id, context.user.id);
      setManageNotice(`${property.nickname} restored.`);
      await load();
    } catch (actionError) {
      setManageError(actionError instanceof Error ? actionError.message : 'Failed to restore this home.');
    } finally {
      setManagingId(null);
    }
  };

  const workInProperty = (propertyId: string) => {
    setActivePropertyId(propertyId);
    router.push('/dashboard');
  };

  const submitBuilding = async (event: FormEvent) => {
    event.preventDefault();
    if (!context?.user || creatingBuilding || addingLocked) {
      return;
    }

    const nickname = buildingDraft.nickname.trim();
    if (!nickname) {
      setBuildingError('Give the building a name before recording it.');
      return;
    }

    setCreatingBuilding(true);
    setBuildingError('');
    setBuildingNotice('');

    try {
      await createPropertyForUser(context.user, {
        nickname,
        property_type: 'apartment_building',
        city: buildingDraft.city.trim() || null,
        state: buildingDraft.state.trim() || null
      });
      setBuildingDraft({ nickname: '', city: '', state: '' });
      setBuildingNotice(`${nickname} recorded. Add its units from the property table below.`);
      await load();
    } catch (createError) {
      setBuildingError(createError instanceof Error ? createError.message : 'Failed to record the building.');
    } finally {
      setCreatingBuilding(false);
    }
  };

  const openUnitsForm = (buildingId: string) => {
    setUnitsTargetId((current) => (current === buildingId ? null : buildingId));
    setUnitsDraft('');
    setUnitsError('');
    setUnitsResult(null);
  };

  const submitUnits = async (event: FormEvent, building: PropertySummary) => {
    event.preventDefault();
    if (!context?.user || creatingUnits || addingLocked) {
      return;
    }

    const labels = unitsDraft
      .split('\n')
      .map((label) => label.trim())
      .filter(Boolean);

    if (labels.length === 0) {
      setUnitsError('Enter at least one unit label — one per line.');
      return;
    }

    setCreatingUnits(true);
    setUnitsError('');
    setUnitsResult(null);

    try {
      const result = await createUnitsForBuilding(context.user, building, labels);
      setUnitsResult({
        buildingId: building.id,
        createdCount: result.created.length,
        failed: result.failed
      });
      if (result.failed.length === 0) {
        setUnitsDraft('');
      }
      await load();
    } catch (createError) {
      setUnitsError(createError instanceof Error ? createError.message : 'Failed to record units.');
    } finally {
      setCreatingUnits(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Portfolio" description="Every door in one record, rolled up." />
        <Card>
          <p style={{ ...subtleText, margin: 0 }}>Loading the portfolio...</p>
        </Card>
      </>
    );
  }

  // Signed out or demo mode: the portfolio spans an account's properties.
  if (!context || context.mode !== 'supabase' || !context.user) {
    return (
      <>
        <PageHeader title="Portfolio" description="Every door in one record, rolled up." />
        <Card>
          <h2 style={{ marginTop: 0 }}>Portfolio is part of an account</h2>
          <p style={subtleText}>
            Demo data is stored only in this browser, and it holds a single property. Portfolio
            roll-ups read across every property saved to an account — each unit keeps the same full
            home record, and this page gathers the repairs, reminders, warranties, and compliance
            across all of them.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <ActionLink href="/sign-up">Create your account</ActionLink>
            <ActionLink href="/sign-in" variant="secondary">
              Sign in
            </ActionLink>
          </div>
        </Card>
      </>
    );
  }

  const buildingFormDisabled = addingLocked || creatingBuilding;

  const buildingForm = (
    <form onSubmit={submitBuilding} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Building name</span>
          <Input
            value={buildingDraft.nickname}
            onChange={(event) => setBuildingDraft((prev) => ({ ...prev, nickname: event.target.value }))}
            placeholder="Maple Court"
            required
            disabled={buildingFormDisabled}
            style={fieldStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>City (optional)</span>
          <Input
            value={buildingDraft.city}
            onChange={(event) => setBuildingDraft((prev) => ({ ...prev, city: event.target.value }))}
            disabled={buildingFormDisabled}
            style={fieldStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>State (optional)</span>
          <Input
            value={buildingDraft.state}
            onChange={(event) => setBuildingDraft((prev) => ({ ...prev, state: event.target.value }))}
            disabled={buildingFormDisabled}
            style={fieldStyle}
          />
        </label>
      </div>
      {addingLocked ? (
        <p style={{ ...subtleText, margin: 0 }}>
          Adding to the portfolio needs the Portfolio plan — see the upgrade note below.
        </p>
      ) : null}
      {buildingError ? (
        <p style={{ margin: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>{buildingError}</p>
      ) : null}
      {buildingNotice ? (
        <p style={{ margin: 0, color: 'var(--status-good)', fontWeight: 700 }}>{buildingNotice}</p>
      ) : null}
      <div>
        <Button type="submit" disabled={buildingFormDisabled}>
          {creatingBuilding ? 'Recording...' : 'Record the building'}
        </Button>
      </div>
    </form>
  );

  const planCards = (
    <>
      {addingLocked ? (
        <Card>
          <h2 style={{ marginTop: 0 }}>The Portfolio plan</h2>
          <p style={subtleText}>
            The free record covers {FREE_PROPERTY_ALLOWANCE} properties. Your account holds{' '}
            {access?.propertyCount ?? properties.length} — adding a building or more units is part
            of the Portfolio plan, a recurring plan that covers multi-property roll-ups, the
            compliance calendar, and condition reports.
          </p>
          {checkoutUrl ? (
            <a href={checkoutUrl} className="action-link" style={getControlStyle({ variant: 'primary' })}>
              Upgrade to the Portfolio plan
            </a>
          ) : null}
        </Card>
      ) : null}
      {!paymentsConfigured ? (
        <Card>
          <h2 style={{ marginTop: 0 }}>The Portfolio plan</h2>
          <p style={{ ...subtleText, marginBottom: 0 }}>
            Multi-property roll-ups, the compliance calendar, and condition reports belong to a
            recurring Portfolio plan. Checkout is not yet available, so while it is being set up
            everything here stays open — the free record otherwise covers{' '}
            {FREE_PROPERTY_ALLOWANCE} properties.
          </p>
        </Card>
      ) : null}
    </>
  );

  // 0–1 properties: introduce the concept before showing empty roll-ups.
  if (!overview || properties.length < 2) {
    return (
      <>
        <PageHeader title="Portfolio" description="Every door in one record, rolled up." />
        <div style={{ display: 'grid', gap: 24 }}>
          {error ? (
            <Card>
              <p style={{ margin: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p>
            </Card>
          ) : null}
          <Card>
            <h2 style={{ marginTop: 0 }}>One record for every door</h2>
            <p style={subtleText}>
              A portfolio is kept the same way a home is: every unit gets the same full home record
              — rooms, assets, warranties, repairs, documents, and reminders. This page rolls those
              records up across all your doors: open repairs, reminders coming due, warranties
              expiring, and compliance obligations, in one place.
            </p>
            <p style={subtleText}>
              Begin by recording a building and its units, or add another standalone property.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Button type="button" onClick={() => setShowBuildingForm((value) => !value)}>
                Add a building
              </Button>
              <ActionLink href="/create-property" variant="secondary">
                Add another property
              </ActionLink>
            </div>
          </Card>
          {showBuildingForm ? (
            <Card>
              <h2 style={{ marginTop: 0 }}>Record a building</h2>
              <p style={subtleText}>
                The building holds shared spaces and systems; each unit is added beneath it with its
                own record.
              </p>
              {buildingForm}
            </Card>
          ) : null}
          {planCards}
        </div>
      </>
    );
  }

  const { totals } = overview;
  const complianceTotal = totals.complianceDueSoon + totals.complianceOverdue;

  const statTiles = [
    { label: 'Doors', value: String(totals.doors), detail: null as string | null },
    { label: 'Open repairs', value: String(totals.openRepairs), detail: null },
    { label: 'Reminders due', value: String(totals.remindersDue), detail: null },
    {
      label: `Warranties expiring ≤ ${WARRANTY_HORIZON_DAYS}d`,
      value: String(totals.warrantiesExpiringSoon),
      detail: null
    },
    {
      label: 'Compliance due / overdue',
      value: String(complianceTotal),
      detail: totals.complianceOverdue > 0 ? `${totals.complianceOverdue} overdue` : null
    }
  ];

  const warrantiesToShow = overview.warrantiesExpiring.slice(0, 8);
  const agingToShow = overview.agingAssets.slice(0, 8);
  const complianceToShow = overview.complianceAttention.slice(0, 8);

  return (
    <>
      <PageHeader title="Portfolio" description="Every door in one record, rolled up." />
      <div style={{ display: 'grid', gap: 24 }}>
        {error ? (
          <Card>
            <p style={{ margin: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p>
          </Card>
        ) : null}

        <Card>
          <h2 style={{ marginTop: 0 }}>Across the portfolio</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12
            }}
          >
            {statTiles.map((tile) => (
              <div
                key={tile.label}
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-card)',
                  padding: '12px 14px'
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.62rem',
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)'
                  }}
                >
                  {tile.label}
                </div>
                <div style={{ fontSize: '1.7rem', fontWeight: 600, lineHeight: 1.3 }}>{tile.value}</div>
                {tile.detail ? (
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--status-urgent)' }}>
                    {tile.detail}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Every property</h2>
          <p style={subtleText}>
            Select a property name to work inside it — the whole app switches to that property&apos;s
            record.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <caption style={visuallyHidden}>
                Per-property counts of open repairs, reminders due, warranties expiring, and
                compliance obligations
              </caption>
              <thead>
                <tr>
                  <th scope="col" style={{ ...headCellStyle, textAlign: 'left' }}>
                    Property / unit
                  </th>
                  <th scope="col" style={headCellStyle}>
                    Open repairs
                  </th>
                  <th scope="col" style={headCellStyle}>
                    Reminders due
                  </th>
                  <th scope="col" style={headCellStyle}>
                    Warranties expiring
                  </th>
                  <th scope="col" style={{ ...headCellStyle, textAlign: 'left' }}>
                    Compliance
                  </th>
                  <th scope="col" style={{ ...headCellStyle, textAlign: 'left' }}>
                    Manage
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.rows.map((row) => {
                  const property = row.property;
                  const isUnit = Boolean(property.parent_property_id);
                  const displayName = isUnit
                    ? property.unit_label ?? property.nickname
                    : property.nickname;
                  const rowIsBuilding = isBuilding(property);
                  const unitsOpen = unitsTargetId === property.id;

                  return (
                    <Fragment key={property.id}>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px', paddingLeft: isUnit ? 32 : 12 }}>
                          <button
                            type="button"
                            style={nameButtonStyle}
                            onClick={() => workInProperty(property.id)}
                          >
                            {displayName}
                          </button>
                          {rowIsBuilding ? (
                            <>
                              <span style={{ ...subtleText, marginLeft: 8, fontSize: '0.82rem' }}>
                                {row.unitCount === 1 ? '1 unit' : `${row.unitCount} units`}
                              </span>
                              <button
                                type="button"
                                onClick={() => openUnitsForm(property.id)}
                                disabled={addingLocked}
                                aria-expanded={unitsOpen}
                                style={{
                                  marginLeft: 12,
                                  padding: '4px 8px',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.64rem',
                                  fontWeight: 600,
                                  letterSpacing: '0.1em',
                                  textTransform: 'uppercase',
                                  border: '1px solid var(--border-subtle)',
                                  borderRadius: 'var(--radius-control)',
                                  background: 'var(--surface-page)',
                                  color: addingLocked ? 'var(--text-muted)' : 'var(--color-brass-deep)',
                                  cursor: addingLocked ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {unitsOpen ? 'Close' : 'Add units'}
                              </button>
                            </>
                          ) : null}
                        </td>
                        <td style={numberCellStyle}>{row.openRepairs}</td>
                        <td style={numberCellStyle}>{row.remindersDue}</td>
                        <td style={numberCellStyle}>{row.warrantiesExpiringSoon}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          {row.complianceOverdue > 0 ? (
                            <span style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>
                              {row.complianceOverdue} overdue
                            </span>
                          ) : null}
                          {row.complianceOverdue > 0 && row.complianceDueSoon > 0 ? ' · ' : null}
                          {row.complianceDueSoon > 0 ? `${row.complianceDueSoon} due soon` : null}
                          {row.complianceOverdue === 0 && row.complianceDueSoon === 0 ? (
                            <span style={subtleText}>None due</span>
                          ) : null}
                        </td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          {context?.user && property.owner_user_id === context.user.id ? (
                            <span style={{ display: 'inline-flex', gap: 8 }}>
                              {!isUnit ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  disabled={managingId === property.id}
                                  onClick={() => archiveProperty(property)}
                                >
                                  Archive
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={managingId === property.id}
                                onClick={() => deleteProperty(property)}
                                style={{ color: 'var(--status-urgent)', borderColor: 'var(--status-urgent)' }}
                              >
                                Delete
                              </Button>
                            </span>
                          ) : (
                            <span style={subtleText}>Owner only</span>
                          )}
                        </td>
                      </tr>
                      {rowIsBuilding && unitsOpen ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '12px 12px 18px', background: 'var(--surface-page)' }}>
                            <form
                              onSubmit={(event) => submitUnits(event, property)}
                              style={{ display: 'grid', gap: 10, maxWidth: 480 }}
                            >
                              <label style={{ display: 'grid', gap: 6 }}>
                                <span style={{ fontWeight: 600 }}>
                                  Units for {property.nickname} — one unit label per line
                                </span>
                                <textarea
                                  value={unitsDraft}
                                  onChange={(event) => setUnitsDraft(event.target.value)}
                                  rows={4}
                                  placeholder={'Unit 1\nUnit 2\nUnit 3'}
                                  disabled={addingLocked || creatingUnits}
                                  style={{ ...fieldStyle, fontFamily: 'inherit', fontSize: '0.95rem', resize: 'vertical' }}
                                />
                              </label>
                              {unitsError ? (
                                <p style={{ margin: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
                                  {unitsError}
                                </p>
                              ) : null}
                              {unitsResult && unitsResult.buildingId === property.id ? (
                                <div>
                                  {unitsResult.createdCount > 0 ? (
                                    <p style={{ margin: 0, color: 'var(--status-good)', fontWeight: 700 }}>
                                      {unitsResult.createdCount === 1
                                        ? '1 unit recorded.'
                                        : `${unitsResult.createdCount} units recorded.`}
                                    </p>
                                  ) : null}
                                  {unitsResult.failed.length > 0 ? (
                                    <div style={{ marginTop: 6 }}>
                                      <p style={{ margin: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
                                        {unitsResult.failed.length === 1
                                          ? '1 unit could not be recorded:'
                                          : `${unitsResult.failed.length} units could not be recorded:`}
                                      </p>
                                      <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                                        {unitsResult.failed.map((failure) => (
                                          <li key={failure.label} style={{ color: 'var(--status-urgent)' }}>
                                            <strong>{failure.label}</strong> — {failure.message}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              <div>
                                <Button type="submit" disabled={addingLocked || creatingUnits}>
                                  {creatingUnits ? 'Recording units...' : 'Record units'}
                                </Button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {manageError ? (
            <p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: '12px 0 0' }} role="alert">{manageError}</p>
          ) : null}
          {manageNotice ? (
            <p style={{ color: 'var(--status-good)', fontWeight: 600, margin: '12px 0 0' }} role="status">{manageNotice}</p>
          ) : null}
        </Card>

        {archivedProperties.length > 0 ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Archived homes</h2>
            <p style={subtleText}>
              Set aside, not gone: every record is kept and can be restored for {ARCHIVE_RETENTION_DAYS} days
              from archiving. After that the home is deleted automatically. Archived homes still count
              toward your plan — only deleting changes it, from your next billing cycle.
            </p>
            <div style={{ display: 'grid', gap: 12 }}>
              {archivedProperties.map((property) => (
                <div
                  key={property.id}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    gap: 12,
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <strong>{property.nickname}</strong>
                    <div style={subtleText}>
                      Archived {property.archived_at ? new Date(property.archived_at).toLocaleDateString() : ''} ·
                      auto-deletes {property.archived_at ? archiveDeleteDate(property.archived_at).toLocaleDateString() : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={managingId === property.id}
                      onClick={() => restoreProperty(property)}
                    >
                      Restore
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={managingId === property.id}
                      onClick={() => deleteProperty(property)}
                      style={{ color: 'var(--status-urgent)', borderColor: 'var(--status-urgent)' }}
                    >
                      Delete now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card>
          <h2 style={{ marginTop: 0 }}>Warranties expiring</h2>
          {warrantiesToShow.length === 0 ? (
            <p style={{ ...subtleText, marginBottom: 0 }}>
              Nothing expires within {WARRANTY_HORIZON_DAYS} days.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
              {warrantiesToShow.map((asset) => (
                <li
                  key={asset.id}
                  style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}
                >
                  <strong>{asset.name}</strong>
                  {asset.brand || asset.model ? (
                    <span style={subtleText}> — {[asset.brand, asset.model].filter(Boolean).join(' ')}</span>
                  ) : null}
                  <div style={{ ...subtleText, fontSize: '0.88rem' }}>
                    {propertyName(asset.property_id)} · {daysLeftLabel(asset.daysLeft)} (
                    {formatDate(asset.warranty_expires_at)})
                  </div>
                </li>
              ))}
            </ul>
          )}
          {overview.warrantiesExpiring.length > warrantiesToShow.length ? (
            <p style={{ ...subtleText, marginTop: 10, marginBottom: 0 }}>
              And {overview.warrantiesExpiring.length - warrantiesToShow.length} more within the
              horizon.
            </p>
          ) : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Aging equipment</h2>
          {agingToShow.length === 0 ? (
            <p style={{ ...subtleText, marginBottom: 0 }}>
              No recorded equipment is older than {AGING_ASSET_YEARS} years.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
              {agingToShow.map((asset) => (
                <li
                  key={asset.id}
                  style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}
                >
                  <strong>{asset.name}</strong>
                  {asset.brand || asset.model ? (
                    <span style={subtleText}> — {[asset.brand, asset.model].filter(Boolean).join(' ')}</span>
                  ) : null}
                  <div style={{ ...subtleText, fontSize: '0.88rem' }}>
                    {propertyName(asset.property_id)} · about {asset.ageYears} years old
                  </div>
                </li>
              ))}
            </ul>
          )}
          {overview.agingAssets.length > agingToShow.length ? (
            <p style={{ ...subtleText, marginTop: 10, marginBottom: 0 }}>
              And {overview.agingAssets.length - agingToShow.length} more past {AGING_ASSET_YEARS}{' '}
              years.
            </p>
          ) : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Compliance needing attention</h2>
          {complianceToShow.length === 0 ? (
            <p style={subtleText}>Nothing is overdue or coming due.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
              {complianceToShow.map((obligation) => (
                <li
                  key={obligation.id}
                  style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}
                >
                  <strong>{obligation.title}</strong>
                  {obligation.authority ? <span style={subtleText}> — {obligation.authority}</span> : null}
                  <div style={{ fontSize: '0.88rem' }}>
                    <span style={subtleText}>
                      {propertyName(obligation.property_id)} · due {formatDate(obligation.next_due)} ·{' '}
                    </span>
                    {obligation.overdue && obligation.daysLeft !== null ? (
                      <span style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>
                        Overdue by {Math.abs(obligation.daysLeft)}{' '}
                        {Math.abs(obligation.daysLeft) === 1 ? 'day' : 'days'}
                      </span>
                    ) : (
                      <span style={subtleText}>
                        {obligation.daysLeft === 0
                          ? 'Due today'
                          : `Due in ${obligation.daysLeft} ${obligation.daysLeft === 1 ? 'day' : 'days'}`}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {overview.complianceAttention.length > complianceToShow.length ? (
            <p style={{ ...subtleText, marginTop: 10 }}>
              And {overview.complianceAttention.length - complianceToShow.length} more needing
              attention.
            </p>
          ) : null}
          <div style={{ marginTop: complianceToShow.length === 0 ? 0 : 12 }}>
            <ActionLink href="/compliance" variant="secondary">
              Open the compliance calendar
            </ActionLink>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Add to the portfolio</h2>
          <p style={subtleText}>
            Record a building here, then add its units from the property table above. Standalone
            homes are added the usual way.
          </p>
          {buildingForm}
          <div style={{ marginTop: 14 }}>
            <ActionLink href="/create-property" variant="secondary">
              Add another property
            </ActionLink>
          </div>
        </Card>

        {planCards}
      </div>
    </>
  );
}
