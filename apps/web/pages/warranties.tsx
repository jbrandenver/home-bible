import { useEffect, useMemo, useState } from 'react';
import {
  expectedLifespanYears,
  formatEnumLabel,
  getWarrantyMeta,
  lifespanStatus,
  safeHttpUrl,
  toLocalDateString
} from '@home-folder/shared';
import { PageHeader, Card, Button, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import {
  getAssetDataContext,
  getAssetsForContext,
  updateAssetForContext,
  type AssetDataContext,
  type AssetDataMode,
  type AssetRow
} from '../lib/assets';
import { getDocumentDataContext, getDocumentsForContext, type DocumentRow } from '../lib/documents';
import {
  createReminderForContext,
  getReminderDataContext,
  type ReminderDataContext
} from '../lib/reminders';
import { dismissRecallMatch, listRecallMatches, type RecallMatchRow } from '../lib/recalls';

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'rgba(95,107,72,0.15)';
    case 'expiring_soon':
      return 'rgba(227,194,136,0.22)';
    case 'expired':
      return 'rgba(163,78,51,0.12)';
    default:
      return 'var(--surface-page)';
  }
}

function getStatusTextColor(status: string): string {
  switch (status) {
    case 'active':
      return 'var(--status-good)';
    case 'expiring_soon':
      return 'var(--color-brass-deep)';
    case 'expired':
      return 'var(--status-urgent)';
    default:
      return 'var(--text-muted)';
  }
}

export default function WarrantiesPage() {
  const [context, setContext] = useState<AssetDataContext | null>(null);
  const [reminderContext, setReminderContext] = useState<ReminderDataContext | null>(null);
  const [dataMode, setDataMode] = useState<AssetDataMode>('demo');
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingAssetId, setSavingAssetId] = useState<string | null>(null);
  const [savingReminderAssetId, setSavingReminderAssetId] = useState<string | null>(null);
  const [recallMatches, setRecallMatches] = useState<RecallMatchRow[]>([]);
  const [recallsAvailable, setRecallsAvailable] = useState(false);
  const [dismissingRecallId, setDismissingRecallId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    purchase_date: '',
    warranty_length_months: '',
    warranty_expires_at: '',
    support_url: '',
    manual_url: ''
  });

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError('');
      setNotice('');

      try {
        const [nextContext, nextReminderContext, nextDocumentContext] = await Promise.all([
          getAssetDataContext(),
          getReminderDataContext(),
          getDocumentDataContext()
        ]);
        const [nextAssets, nextDocuments] = await Promise.all([
          getAssetsForContext(nextContext),
          getDocumentsForContext(nextDocumentContext)
        ]);

        // Recall matches are written server-side by the check-recalls cron
        // (migration 024). When the table is unreachable — migration not yet
        // applied, or no cron configured — the section simply stays hidden:
        // recalls are additive, never blocking, never error spam.
        let nextRecalls: RecallMatchRow[] = [];
        let recallsReachable = false;
        if (nextContext.mode === 'supabase' && nextContext.property) {
          try {
            nextRecalls = await listRecallMatches(nextContext.property.id);
            recallsReachable = true;
          } catch {
            recallsReachable = false;
          }
        }

        if (!isMounted) {
          return;
        }

        setContext(nextContext);
        setReminderContext(nextReminderContext);
        setDataMode(nextContext.mode);
        setAssets(nextAssets);
        setDocuments(nextDocuments);
        setRecallMatches(nextRecalls);
        setRecallsAvailable(recallsReachable);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load warranties.');
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

  const assetsByStatus = useMemo(
    () => ({
      active: assets.filter((a) => getWarrantyMeta(a).status === 'active'),
      expiring_soon: assets.filter((a) => getWarrantyMeta(a).status === 'expiring_soon'),
      expired: assets.filter((a) => getWarrantyMeta(a).status === 'expired'),
      unknown: assets.filter((a) => getWarrantyMeta(a).status === 'unknown')
    }),
    [assets]
  );

  const warrantyDocumentCountsByAsset = useMemo(() => {
    return documents.reduce<Record<string, number>>((acc, document) => {
      if (
        document.asset_id &&
        ['warranty', 'receipt', 'invoice', 'manual', 'asset_document'].includes(document.document_type)
      ) {
        acc[document.asset_id] = (acc[document.asset_id] || 0) + 1;
      }

      return acc;
    }, {});
  }, [documents]);

  const assetNamesById = useMemo(() => {
    return assets.reduce<Record<string, string>>((acc, asset) => {
      acc[asset.id] = asset.name;
      return acc;
    }, {});
  }, [assets]);

  const openRecallMatches = useMemo(
    () => recallMatches.filter((match) => match.status === 'open'),
    [recallMatches]
  );

  const dismissRecall = async (match: RecallMatchRow) => {
    const assetName = assetNamesById[match.asset_id] || 'this appliance';
    const confirmed = window.confirm(
      `Dismiss this recall notice for ${assetName}? Dismissing only hides the notice from this list — it does not fix or repair the appliance.`
    );
    if (!confirmed) {
      return;
    }

    setDismissingRecallId(match.id);
    setError('');

    try {
      const updated = await dismissRecallMatch(match.id);
      setRecallMatches((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (dismissError) {
      setError(dismissError instanceof Error ? dismissError.message : 'Failed to dismiss recall notice.');
    } finally {
      setDismissingRecallId(null);
    }
  };

  const startEditing = (asset: AssetRow) => {
    setEditingAssetId(asset.id);
    setDraft({
      purchase_date: asset.purchase_date || '',
      warranty_length_months:
        asset.warranty_length_months !== undefined && asset.warranty_length_months !== null
          ? String(asset.warranty_length_months)
          : '',
      warranty_expires_at: asset.warranty_expires_at || '',
      support_url: asset.support_url || '',
      manual_url: asset.manual_url || ''
    });
  };

  const saveWarrantyChanges = async (assetId: string) => {
    if (!context) {
      setError('Asset details are still loading. Please try again.');
      return;
    }

    setSavingAssetId(assetId);
    setError('');

    try {
      const updatedAsset = await updateAssetForContext(context, assetId, {
        purchase_date: draft.purchase_date || null,
        warranty_length_months: draft.warranty_length_months ? Number(draft.warranty_length_months) : null,
        warranty_expires_at: draft.warranty_expires_at || null,
        support_url: draft.support_url || null,
        manual_url: draft.manual_url || null
      });

      if (updatedAsset) {
        setAssets((currentAssets) =>
          currentAssets.map((asset) => (asset.id === updatedAsset.id ? updatedAsset : asset))
        );
      }

      setEditingAssetId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save warranty changes.');
    } finally {
      setSavingAssetId(null);
    }
  };

  const createWarrantyReminder = async (asset: AssetRow) => {
    if (!reminderContext) {
      setError('Reminder details are still loading. Please try again.');
      return;
    }

    const warrantyMeta = getWarrantyMeta(asset);
    if (!warrantyMeta.expirationDate) {
      setError('Add a warranty expiration date before creating a warranty reminder.');
      return;
    }

    setSavingReminderAssetId(asset.id);
    setError('');
    setNotice('');

    try {
      await createReminderForContext(reminderContext, {
        title: `Review warranty for ${asset.name}`,
        description: `Warranty reminder created from the warranty tracker for ${asset.name}.`,
        reminder_type: 'warranty',
        due_date: warrantyMeta.expirationDate,
        linked_type: 'asset',
        linked_id: asset.id,
        asset_id: asset.id,
        frequency: 'none',
        status: 'open',
        priority:
          warrantyMeta.daysRemaining !== null && warrantyMeta.daysRemaining <= 30
            ? 'high'
            : 'normal',
        source: 'warranty'
      });

      setNotice(`Warranty reminder created for ${asset.name}.`);
    } catch (reminderError) {
      setError(reminderError instanceof Error ? reminderError.message : 'Failed to create warranty reminder.');
    } finally {
      setSavingReminderAssetId(null);
    }
  };

  const renderAssetGroup = (status: string, statusAssets: AssetRow[]) => {
    if (statusAssets.length === 0) return null;

    return (
      <div key={status} style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12, color: getStatusTextColor(status) }}>
          {formatEnumLabel(status)} ({statusAssets.length})
        </h3>

        <div style={{ display: 'grid', gap: 12 }}>
          {statusAssets.map((asset) => {
            const { status: assetStatus, daysRemaining, expirationDate } = getWarrantyMeta(asset);
            const isEditing = editingAssetId === asset.id;
            // Lifespan flags are computed client-side from asset data (pure,
            // InterNACHI planning estimates), so they work in demo mode too.
            const lifespanYears = expectedLifespanYears(asset.asset_type, asset.name);
            const lifespan =
              lifespanYears !== null && asset.purchase_date
                ? lifespanStatus(asset.purchase_date, lifespanYears, toLocalDateString())
                : null;

            return (
              <Card key={asset.id}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px 0' }}>{asset.name}</h4>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <div
                        style={{
                          padding: '4px 8px',
                          backgroundColor: getStatusColor(assetStatus),
                          color: getStatusTextColor(assetStatus),
                          borderRadius: 4,
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}
                      >
                        {formatEnumLabel(assetStatus)}
                        {daysRemaining !== null && ` (${daysRemaining}d)`}
                      </div>
                      {asset.brand && <UtilityBadge label={asset.brand} />}
                      <UtilityBadge label={`${warrantyDocumentCountsByAsset[asset.id] || 0} doc${warrantyDocumentCountsByAsset[asset.id] === 1 ? '' : 's'}`} />
                      {lifespan && lifespanYears !== null && lifespan.status !== 'within' && (
                        <div
                          style={{
                            padding: '4px 8px',
                            backgroundColor:
                              lifespan.status === 'past_expected'
                                ? 'rgba(163,78,51,0.12)'
                                : 'rgba(227,194,136,0.22)',
                            color:
                              lifespan.status === 'past_expected'
                                ? 'var(--status-urgent)'
                                : 'var(--color-brass-deep)',
                            borderRadius: 4,
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                        >
                          {lifespan.status === 'past_expected'
                            ? `Past expected life (${Math.floor(lifespan.ageYears)} yrs, expected ~${lifespanYears})`
                            : `Nearing expected life (${Math.floor(lifespan.ageYears)} yrs, expected ~${lifespanYears})`}
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {expirationDate && (
                        <div>
                          <strong>Expires:</strong> {expirationDate}
                        </div>
                      )}
                      {asset.purchase_date && asset.warranty_length_months && (
                        <div>
                          <strong>Coverage:</strong> {asset.warranty_length_months} months from {asset.purchase_date}
                        </div>
                      )}
                      {safeHttpUrl(asset.manual_url) && (
                        <div>
                          <a
                            href={safeHttpUrl(asset.manual_url) || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent-strong)', textDecoration: 'none' }}
                          >
                            📄 Manual
                          </a>
                        </div>
                      )}
                      {safeHttpUrl(asset.support_url) && (
                        <div>
                          <a
                            href={safeHttpUrl(asset.support_url) || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent-strong)', textDecoration: 'none' }}
                          >
                            🔗 Support
                          </a>
                        </div>
                      )}

                      {isEditing && (
                        <div
                          style={{
                            marginTop: 12,
                            padding: 12,
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 8,
                            background: 'var(--surface-page)',
                            display: 'grid',
                            gap: 8
                          }}
                        >
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>Purchase date</span>
                            <input
                              type="date"
                              value={draft.purchase_date}
                              onChange={(e) => setDraft((prev) => ({ ...prev, purchase_date: e.target.value }))}
                              style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>Warranty length (months)</span>
                            <input
                              type="number"
                              min={0}
                              value={draft.warranty_length_months}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, warranty_length_months: e.target.value }))
                              }
                              style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>Warranty expiration date</span>
                            <input
                              type="date"
                              value={draft.warranty_expires_at}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, warranty_expires_at: e.target.value }))
                              }
                              style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>Support URL</span>
                            <input
                              type="url"
                              value={draft.support_url}
                              onChange={(e) => setDraft((prev) => ({ ...prev, support_url: e.target.value }))}
                              placeholder="https://"
                              style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>Manual URL</span>
                            <input
                              type="url"
                              value={draft.manual_url}
                              onChange={(e) => setDraft((prev) => ({ ...prev, manual_url: e.target.value }))}
                              placeholder="https://"
                              style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                            />
                          </label>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <Button
                              type="button"
                              onClick={() => saveWarrantyChanges(asset.id)}
                              disabled={savingAssetId === asset.id}
                            >
                              {savingAssetId === asset.id ? 'Saving...' : 'Save'}
                            </Button>
                            <button
                              type="button"
                              onClick={() => setEditingAssetId(null)}
                              style={{
                                padding: '10px 16px',
                                backgroundColor: 'var(--surface-page)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Button type="button" onClick={() => startEditing(asset)}>
                      Edit warranty
                    </Button>
                    <Button
                      type="button"
                      onClick={() => createWarrantyReminder(asset)}
                      disabled={savingReminderAssetId === asset.id}
                    >
                      {savingReminderAssetId === asset.id ? 'Saving...' : 'Add reminder'}
                    </Button>
                    <ActionLink href={`/assets/${asset.id}`} variant="secondary">View</ActionLink>
                    <ActionLink href={`/documents?assetId=${asset.id}`} variant="secondary">Documents</ActionLink>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <PageHeader
          title="Warranties"
          description="Coverage, dates, and proof for the things in your home."
        />
        <Card>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading warranties...</p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Warranties"
        description="Coverage, dates, and proof for the things in your home."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        {dataMode === 'supabase' && recallsAvailable && openRecallMatches.length > 0 && (
          <section aria-labelledby="safety-recalls-heading">
            <Card>
              <h2 id="safety-recalls-heading" style={{ marginTop: 0, color: 'var(--status-urgent)' }}>
                Safety recalls
              </h2>
              <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
                These recorded appliances match official CPSC recall notices. Always read the
                official notice — a recall can cover more or fewer units than a model-number match.
              </p>
              <div style={{ display: 'grid', gap: 12 }}>
                {openRecallMatches.map((match) => (
                  <div
                    key={match.id}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      padding: 12,
                      background: 'var(--surface-page)'
                    }}
                  >
                    <h3 style={{ margin: '0 0 4px 0' }}>
                      {assetNamesById[match.asset_id] || 'An appliance no longer in your list'}
                    </h3>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 700 }}>
                      Recall {match.recall_number}
                      {match.title ? `: ${match.title}` : ''}
                    </p>
                    <div style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
                      {match.hazard && (
                        <p style={{ margin: 0 }}>
                          <strong>Hazard:</strong> {match.hazard}
                        </p>
                      )}
                      {match.remedy && (
                        <p style={{ margin: 0 }}>
                          <strong>Remedy:</strong> {match.remedy}
                        </p>
                      )}
                      {match.matched_on && (
                        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                          Matched on {match.matched_on}.
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                      {safeHttpUrl(match.recall_url) && (
                        <a
                          href={safeHttpUrl(match.recall_url) || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--accent-strong)', fontWeight: 600 }}
                        >
                          View official notice
                        </a>
                      )}
                      <Button
                        type="button"
                        onClick={() => dismissRecall(match)}
                        disabled={dismissingRecallId === match.id}
                      >
                        {dismissingRecallId === match.id ? 'Dismissing...' : 'Dismiss'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}

        <Card>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? 'var(--status-good)' : 'var(--text-muted)' }}>
            {dataMode === 'supabase'
              ? 'Saved to your account.'
              : 'Demo data is stored only in this browser.'}
          </p>
          {dataMode === 'supabase' && recallsAvailable && openRecallMatches.length === 0 ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No recalls found for your recorded appliances. Checked automatically against the CPSC
              database.
            </p>
          ) : null}
          {error ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {error}
            </p>
          ) : null}
          {notice ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-good)', fontWeight: 700 }}>
              {notice}
            </p>
          ) : null}
        </Card>

        {assets.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: 24 }}>
              <h2>No assets with warranty info yet</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                Add assets and enter warranty information to track coverage here.
              </p>
              <ActionLink href="/add-asset">Add your first asset</ActionLink>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <h2 style={{ marginTop: 0 }}>Warranty Summary</h2>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <UtilityBadge label={`${assetsByStatus.active.length} active`} />
                <UtilityBadge label={`${assetsByStatus.expiring_soon.length} expiring soon`} />
                <UtilityBadge label={`${assetsByStatus.expired.length} expired`} />
                <UtilityBadge label={`${assetsByStatus.unknown.length} unknown`} />
              </div>
            </Card>

            <div>
              {renderAssetGroup('active', assetsByStatus.active)}
              {renderAssetGroup('expiring_soon', assetsByStatus.expiring_soon)}
              {renderAssetGroup('expired', assetsByStatus.expired)}
              {renderAssetGroup('unknown', assetsByStatus.unknown)}
            </div>
          </>
        )}
      </div>
    </>
  );
}
