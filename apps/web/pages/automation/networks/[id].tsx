import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AUTOMATION_NETWORK_TYPES, formatEnumLabel, type AutomationNetworkType } from '@home-folder/shared';
import { Button, Card, Input, PageHeader, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../../components/ActionLink';
import {
  deleteNetworkForContext,
  getAutomationContext,
  getNetworkById,
  updateNetworkForContext,
  type AutomationDataContext,
  type AutomationNetworkRow
} from '../../../lib/automation';

export default function NetworkDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const networkId = typeof id === 'string' ? id : '';

  const [context, setContext] = useState<AutomationDataContext | null>(null);
  const [network, setNetwork] = useState<AutomationNetworkRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!networkId) return;
      setLoading(true);
      setError('');
      try {
        const ctx = await getAutomationContext();
        const row = await getNetworkById(ctx, networkId);
        if (!isMounted) return;
        setContext(ctx);
        setNetwork(row);
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e.message : 'Failed to load network.');
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
  }, [networkId]);

  const startEdit = () => {
    if (!network) return;
    setForm({
      name: network.name,
      network_type: network.network_type,
      ssid: network.ssid || '',
      internet_provider: network.internet_provider || '',
      is_guest: network.is_guest,
      is_iot: network.is_iot,
      physical_location: network.physical_location || '',
      recovery_instructions: network.recovery_instructions || '',
      credential_reference: network.credential_reference || '',
      notes: network.notes || ''
    });
    setEditing(true);
  };

  const save = async () => {
    if (!context || !network) return;
    setActing(true);
    setError('');
    try {
      const s = (k: string) => (typeof form[k] === 'string' ? (form[k] as string).trim() || null : null);
      const updated = await updateNetworkForContext(context, network.id, {
        name: String(form.name || '').trim() || network.name,
        network_type: form.network_type as AutomationNetworkType,
        ssid: s('ssid'),
        internet_provider: s('internet_provider'),
        is_guest: Boolean(form.is_guest),
        is_iot: Boolean(form.is_iot),
        physical_location: s('physical_location'),
        recovery_instructions: s('recovery_instructions'),
        credential_reference: s('credential_reference'),
        notes: s('notes')
      });
      if (updated) setNetwork(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setActing(false);
    }
  };

  const remove = async () => {
    if (!context || !network) return;
    if (!window.confirm(`Remove "${network.name}"?`)) return;
    setActing(true);
    try {
      await deleteNetworkForContext(context, network.id);
      router.push('/automation/networks');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete.');
      setActing(false);
    }
  };

  if (loading) return (<><PageHeader title="Network" /><Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p></Card></>);
  if (error && !network) return (<><PageHeader title="Could not load this network" /><Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p><ActionLink href="/automation/networks" variant="secondary">Back to networks</ActionLink></Card></>);
  if (!network) return (<><PageHeader title="Network not found" /><Card><ActionLink href="/automation/networks" variant="secondary">Back to networks</ActionLink></Card></>);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <PageHeader eyebrow="Network" title={network.name} description={formatEnumLabel(network.network_type)}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {network.is_iot ? <UtilityBadge label="IoT" /> : null}
          {network.is_guest ? <UtilityBadge label="Guest" /> : null}
          {context?.mode === 'supabase' && !editing ? <Button variant="secondary" onClick={startEdit}>Edit</Button> : null}
        </div>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        {editing ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Edit network</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <label><span>Name</span><Input value={String(form.name ?? '')} onChange={(e) => set('name', e.target.value)} style={{ marginTop: 6 }} /></label>
                <label><span>Type</span><Select value={String(form.network_type ?? '')} onChange={(e) => set('network_type', e.target.value)} style={{ marginTop: 6 }}>{AUTOMATION_NETWORK_TYPES.map((t) => <option key={t} value={t}>{formatEnumLabel(t)}</option>)}</Select></label>
                <label><span>SSID</span><Input value={String(form.ssid ?? '')} onChange={(e) => set('ssid', e.target.value)} style={{ marginTop: 6 }} /></label>
                <label><span>Provider</span><Input value={String(form.internet_provider ?? '')} onChange={(e) => set('internet_provider', e.target.value)} style={{ marginTop: 6 }} /></label>
                <label><span>Location</span><Input value={String(form.physical_location ?? '')} onChange={(e) => set('physical_location', e.target.value)} style={{ marginTop: 6 }} /></label>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={Boolean(form.is_iot)} onChange={(e) => set('is_iot', e.target.checked)} /><span>IoT network</span></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={Boolean(form.is_guest)} onChange={(e) => set('is_guest', e.target.checked)} /><span>Guest network</span></label>
              </div>
              <label><span>Recovery instructions (shown in the emergency guide)</span><textarea value={String(form.recovery_instructions ?? '')} onChange={(e) => set('recovery_instructions', e.target.value)} style={{ width: '100%', minHeight: 54, marginTop: 6, padding: 10 }} placeholder="Power-cycle the modem, then the router; wait 3 min." /></label>
              <label><span>Where credentials are stored (reference only — never the Wi-Fi password)</span><Input value={String(form.credential_reference ?? '')} onChange={(e) => set('credential_reference', e.target.value)} placeholder="1Password › Home Wi-Fi" style={{ marginTop: 6 }} /></label>
              <div style={{ display: 'flex', gap: 8 }}><Button onClick={save} disabled={acting}>{acting ? 'Saving…' : 'Save'}</Button><Button variant="secondary" onClick={() => setEditing(false)} disabled={acting}>Cancel</Button></div>
            </div>
          </Card>
        ) : (
          <Card>
            <h2 style={{ marginTop: 0 }}>Details</h2>
            <div style={{ display: 'grid', gap: 6 }}>
              {network.ssid ? <div><strong>SSID:</strong> {network.ssid}</div> : null}
              {network.internet_provider ? <div><strong>Provider:</strong> {network.internet_provider}</div> : null}
              {network.physical_location ? <div><strong>Location:</strong> {network.physical_location}</div> : null}
              <div><strong>Recovery:</strong> {network.recovery_instructions || 'Not recorded'}</div>
              {network.credential_reference ? <div><strong>Credentials:</strong> {network.credential_reference} <span style={{ color: 'var(--text-muted)' }}>(reference only)</span></div> : null}
              {network.notes ? <div><strong>Notes:</strong> {network.notes}</div> : null}
            </div>
          </Card>
        )}
        {error ? <Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>{error}</p></Card> : null}
        <Card>
          <h2 style={{ marginTop: 0 }}>Manage</h2>
          <Button variant="secondary" onClick={remove} disabled={acting} style={{ color: 'var(--status-urgent)', borderColor: 'var(--status-urgent)' }}>Remove network</Button>
        </Card>
      </div>
    </>
  );
}
