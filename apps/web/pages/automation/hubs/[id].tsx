import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AUTOMATION_CRITICALITIES, AUTOMATION_HUB_TYPES, formatEnumLabel, type AutomationCriticality, type AutomationHubType } from '@home-folder/shared';
import { Button, Card, Input, PageHeader, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../../components/ActionLink';
import {
  deleteHubForContext,
  getAutomationContext,
  getHubById,
  updateHubForContext,
  type AutomationDataContext,
  type AutomationHubRow
} from '../../../lib/automation';

export default function HubDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const hubId = typeof id === 'string' ? id : '';

  const [context, setContext] = useState<AutomationDataContext | null>(null);
  const [hub, setHub] = useState<AutomationHubRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!hubId) return;
      setLoading(true);
      setError('');
      try {
        const ctx = await getAutomationContext();
        const row = await getHubById(ctx, hubId);
        if (!isMounted) return;
        setContext(ctx);
        setHub(row);
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e.message : 'Failed to load hub.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load().catch((e) => {
      if (isMounted) {
        setError(e instanceof Error ? e.message : 'Failed to load data.');
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [hubId]);

  const startEdit = () => {
    if (!hub) return;
    setForm({
      name: hub.name,
      hub_type: hub.hub_type,
      manufacturer: hub.manufacturer || '',
      model: hub.model || '',
      criticality: hub.criticality,
      local_control: hub.local_control,
      cloud_dependency: hub.cloud_dependency,
      internet_dependency: hub.internet_dependency,
      firmware_version: hub.firmware_version || '',
      recovery_steps: hub.recovery_steps || '',
      reset_instructions: hub.reset_instructions || '',
      credential_reference: hub.credential_reference || '',
      notes: hub.notes || ''
    });
    setEditing(true);
  };

  const save = async () => {
    if (!context || !hub) return;
    setActing(true);
    setError('');
    try {
      const s = (k: string) => (typeof form[k] === 'string' ? (form[k] as string).trim() || null : null);
      const updated = await updateHubForContext(context, hub.id, {
        name: String(form.name || '').trim() || hub.name,
        hub_type: form.hub_type as AutomationHubType,
        manufacturer: s('manufacturer'),
        model: s('model'),
        criticality: form.criticality as AutomationCriticality,
        local_control: Boolean(form.local_control),
        cloud_dependency: Boolean(form.cloud_dependency),
        internet_dependency: Boolean(form.internet_dependency),
        firmware_version: s('firmware_version'),
        recovery_steps: s('recovery_steps'),
        reset_instructions: s('reset_instructions'),
        credential_reference: s('credential_reference'),
        notes: s('notes')
      });
      if (updated) setHub(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setActing(false);
    }
  };

  const remove = async () => {
    if (!context || !hub) return;
    if (!window.confirm(`Remove "${hub.name}"? Devices that depend on it will lose the link.`)) return;
    setActing(true);
    try {
      await deleteHubForContext(context, hub.id);
      router.push('/automation/hubs');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete.');
      setActing(false);
    }
  };

  if (loading) return (<><PageHeader title="Hub" /><Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p></Card></>);
  if (error && !hub) return (<><PageHeader title="Could not load this hub" /><Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p><ActionLink href="/automation/hubs" variant="secondary">Back to hubs</ActionLink></Card></>);
  if (!hub) return (<><PageHeader title="Hub not found" /><Card><ActionLink href="/automation/hubs" variant="secondary">Back to hubs</ActionLink></Card></>);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <PageHeader eyebrow="Hub / controller" title={hub.name} description={formatEnumLabel(hub.hub_type)}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <UtilityBadge label={formatEnumLabel(hub.status)} />
          {hub.internet_dependency ? <UtilityBadge label="Needs internet" tone="attention" /> : <UtilityBadge label="Local" tone="good" />}
          {hub.criticality === 'critical' || hub.criticality === 'high' ? <UtilityBadge label={formatEnumLabel(hub.criticality)} tone="attention" /> : null}
          {context?.mode === 'supabase' && !editing ? <Button variant="secondary" onClick={startEdit}>Edit</Button> : null}
        </div>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        {editing ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Edit hub</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <label><span>Name</span><Input value={String(form.name ?? '')} onChange={(e) => set('name', e.target.value)} style={{ marginTop: 6 }} /></label>
                <label><span>Type</span><Select value={String(form.hub_type ?? '')} onChange={(e) => set('hub_type', e.target.value)} style={{ marginTop: 6 }}>{AUTOMATION_HUB_TYPES.map((t) => <option key={t} value={t}>{formatEnumLabel(t)}</option>)}</Select></label>
                <label><span>Importance</span><Select value={String(form.criticality ?? '')} onChange={(e) => set('criticality', e.target.value)} style={{ marginTop: 6 }}>{AUTOMATION_CRITICALITIES.map((c) => <option key={c} value={c}>{formatEnumLabel(c)}</option>)}</Select></label>
                <label><span>Manufacturer</span><Input value={String(form.manufacturer ?? '')} onChange={(e) => set('manufacturer', e.target.value)} style={{ marginTop: 6 }} /></label>
                <label><span>Model</span><Input value={String(form.model ?? '')} onChange={(e) => set('model', e.target.value)} style={{ marginTop: 6 }} /></label>
                <label><span>Firmware</span><Input value={String(form.firmware_version ?? '')} onChange={(e) => set('firmware_version', e.target.value)} style={{ marginTop: 6 }} /></label>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={Boolean(form.local_control)} onChange={(e) => set('local_control', e.target.checked)} /><span>Works locally</span></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={Boolean(form.internet_dependency)} onChange={(e) => set('internet_dependency', e.target.checked)} /><span>Needs internet</span></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={Boolean(form.cloud_dependency)} onChange={(e) => set('cloud_dependency', e.target.checked)} /><span>Depends on a cloud service</span></label>
              </div>
              <label><span>Recovery steps (shown in the emergency guide)</span><textarea value={String(form.recovery_steps ?? '')} onChange={(e) => set('recovery_steps', e.target.value)} style={{ width: '100%', minHeight: 54, marginTop: 6, padding: 10 }} /></label>
              <label><span>Reset instructions</span><textarea value={String(form.reset_instructions ?? '')} onChange={(e) => set('reset_instructions', e.target.value)} style={{ width: '100%', minHeight: 54, marginTop: 6, padding: 10 }} /></label>
              <label><span>Where credentials are stored (reference only)</span><Input value={String(form.credential_reference ?? '')} onChange={(e) => set('credential_reference', e.target.value)} placeholder="1Password › Hub account" style={{ marginTop: 6 }} /></label>
              <div style={{ display: 'flex', gap: 8 }}><Button onClick={save} disabled={acting}>{acting ? 'Saving…' : 'Save'}</Button><Button variant="secondary" onClick={() => setEditing(false)} disabled={acting}>Cancel</Button></div>
            </div>
          </Card>
        ) : (
          <Card>
            <h2 style={{ marginTop: 0 }}>Recovery &amp; details</h2>
            <div style={{ display: 'grid', gap: 6 }}>
              <div><strong>Recovery:</strong> {hub.recovery_steps || 'Not recorded'}</div>
              <div><strong>Reset:</strong> {hub.reset_instructions || 'Not recorded'}</div>
              <div><strong>Firmware:</strong> {hub.firmware_version || 'Not recorded'}</div>
              {hub.credential_reference ? <div><strong>Credentials:</strong> {hub.credential_reference} <span style={{ color: 'var(--text-muted)' }}>(reference only)</span></div> : null}
              {hub.notes ? <div><strong>Notes:</strong> {hub.notes}</div> : null}
            </div>
          </Card>
        )}
        {error ? <Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>{error}</p></Card> : null}
        <Card>
          <h2 style={{ marginTop: 0 }}>Manage</h2>
          <Button variant="secondary" onClick={remove} disabled={acting} style={{ color: 'var(--status-urgent)', borderColor: 'var(--status-urgent)' }}>Remove hub</Button>
        </Card>
      </div>
    </>
  );
}
