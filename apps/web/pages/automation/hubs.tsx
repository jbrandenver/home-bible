import { useEffect, useState } from 'react';
import { AUTOMATION_HUB_TYPES, AUTOMATION_STATUS_LABELS, formatEnumLabel, type AutomationHubType } from '@home-folder/shared';
import { Button, Card, EmptyState, Input, PageHeader, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import {
  createHubForContext,
  deleteHubForContext,
  getAutomationContext,
  getHubsForContext,
  type AutomationDataContext,
  type AutomationDataMode,
  type AutomationHubRow
} from '../../lib/automation';

export default function AutomationHubsPage() {
  const [context, setContext] = useState<AutomationDataContext | null>(null);
  const [dataMode, setDataMode] = useState<AutomationDataMode>('demo');
  const [hubs, setHubs] = useState<AutomationHubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [hubType, setHubType] = useState<AutomationHubType>('smart_home_hub');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const nextContext = await getAutomationContext();
        const list = await getHubsForContext(nextContext);
        if (!isMounted) return;
        setContext(nextContext);
        setDataMode(nextContext.mode);
        setHubs(list);
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load hubs.');
      } finally {
        if (isMounted) setLoading(false);
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

  const add = async () => {
    if (!context) return;
    if (!name.trim()) {
      setFormError('Give the hub a name first.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const created = await createHubForContext(context, { name: name.trim(), hub_type: hubType, local_control: true, cloud_dependency: false, internet_dependency: false, criticality: 'normal', status: 'unknown' });
      setHubs((current) => [created, ...current].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to add hub.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (hub: AutomationHubRow) => {
    if (!context) return;
    if (!window.confirm(`Remove "${hub.name}"? Devices that depend on it will lose the link.`)) return;
    try {
      await deleteHubForContext(context, hub.id);
      setHubs((current) => current.filter((h) => h.id !== hub.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete hub.');
    }
  };

  return (
    <>
      <PageHeader eyebrow="Smart Home" title="Hubs & controllers" description="Bridges, hubs, Thread border routers, and controllers your devices depend on.">
        <ActionLink href="/automation" variant="secondary">Overview</ActionLink>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        {dataMode === 'supabase' ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Add a hub or controller</h2>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', alignItems: 'end' }}>
              <label><span>Name</span><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hue Bridge" style={{ marginTop: 6 }} /></label>
              <label><span>Type</span>
                <Select value={hubType} onChange={(e) => setHubType(e.target.value as AutomationHubType)} style={{ marginTop: 6 }}>
                  {AUTOMATION_HUB_TYPES.map((t) => <option key={t} value={t}>{formatEnumLabel(t)}</option>)}
                </Select>
              </label>
              <Button onClick={add} disabled={saving}>{saving ? 'Adding…' : 'Add hub'}</Button>
            </div>
            {formError ? <p style={{ color: 'var(--status-urgent)', fontWeight: 700, marginBottom: 0 }}>{formError}</p> : null}
          </Card>
        ) : null}

        {error ? <Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>{error}</p></Card> : null}

        {loading ? (
          <Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading hubs…</p></Card>
        ) : dataMode === 'demo' ? (
          <EmptyState title="Sign in to record hubs" description="Hubs and controllers save to your account." />
        ) : hubs.length === 0 ? (
          <EmptyState title="No hubs recorded" description="Add the bridges and controllers your devices connect through — Hue Bridge, Aqara hub, Thread border router, Home Assistant." />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {hubs.map((hub) => (
              <Card key={hub.id} style={{ padding: '14px 14px 14px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <div>
                    <strong style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{hub.name}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{[formatEnumLabel(hub.hub_type), hub.manufacturer].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <UtilityBadge label={AUTOMATION_STATUS_LABELS[hub.status]} />
                    {hub.internet_dependency ? <UtilityBadge label="Needs internet" tone="attention" /> : <UtilityBadge label="Local" tone="good" />}
                    {hub.criticality === 'critical' || hub.criticality === 'high' ? <UtilityBadge label={formatEnumLabel(hub.criticality)} tone="attention" /> : null}
                    <ActionLink href={`/automation/hubs/${hub.id}`} variant="secondary">Open</ActionLink>
                    <Button variant="secondary" onClick={() => remove(hub)} style={{ color: 'var(--status-urgent)', borderColor: 'var(--status-urgent)' }}>Remove</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
