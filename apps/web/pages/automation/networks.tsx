import { useEffect, useState } from 'react';
import { AUTOMATION_NETWORK_TYPES, formatEnumLabel, type AutomationNetworkType } from '@home-folder/shared';
import { Button, Card, EmptyState, Input, PageHeader, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import {
  createNetworkForContext,
  deleteNetworkForContext,
  getAutomationContext,
  getNetworksForContext,
  type AutomationDataContext,
  type AutomationDataMode,
  type AutomationNetworkRow
} from '../../lib/automation';

export default function AutomationNetworksPage() {
  const [context, setContext] = useState<AutomationDataContext | null>(null);
  const [dataMode, setDataMode] = useState<AutomationDataMode>('demo');
  const [networks, setNetworks] = useState<AutomationNetworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [networkType, setNetworkType] = useState<AutomationNetworkType>('wifi');
  const [ssid, setSsid] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const nextContext = await getAutomationContext();
        const list = await getNetworksForContext(nextContext);
        if (!isMounted) return;
        setContext(nextContext);
        setDataMode(nextContext.mode);
        setNetworks(list);
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load networks.');
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
      setFormError('Give the network a name first.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const created = await createNetworkForContext(context, {
        name: name.trim(),
        network_type: networkType,
        ssid: ssid.trim() || null,
        is_guest: networkType === 'guest',
        is_iot: networkType === 'iot_vlan'
      });
      setNetworks((current) => [created, ...current].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setSsid('');
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to add network.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (network: AutomationNetworkRow) => {
    if (!context) return;
    if (!window.confirm(`Remove "${network.name}"?`)) return;
    try {
      await deleteNetworkForContext(context, network.id);
      setNetworks((current) => current.filter((n) => n.id !== network.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete network.');
    }
  };

  return (
    <>
      <PageHeader eyebrow="Smart Home" title="Networks" description="The Wi-Fi, wired, IoT, and guest networks your devices live on.">
        <ActionLink href="/automation" variant="secondary">Overview</ActionLink>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        {dataMode === 'supabase' ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Add a network</h2>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'end' }}>
              <label><span>Name</span><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Home Wi-Fi" style={{ marginTop: 6 }} /></label>
              <label><span>Type</span>
                <Select value={networkType} onChange={(e) => setNetworkType(e.target.value as AutomationNetworkType)} style={{ marginTop: 6 }}>
                  {AUTOMATION_NETWORK_TYPES.map((t) => <option key={t} value={t}>{formatEnumLabel(t)}</option>)}
                </Select>
              </label>
              <label><span>SSID</span><Input value={ssid} onChange={(e) => setSsid(e.target.value)} style={{ marginTop: 6 }} /></label>
              <Button onClick={add} disabled={saving}>{saving ? 'Adding…' : 'Add network'}</Button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 0 }}>Never enter a Wi-Fi password here. Store it in a password manager and reference it on the device.</p>
            {formError ? <p style={{ color: 'var(--status-urgent)', fontWeight: 700, marginBottom: 0 }}>{formError}</p> : null}
          </Card>
        ) : null}

        {error ? <Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>{error}</p></Card> : null}

        {loading ? (
          <Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading networks…</p></Card>
        ) : dataMode === 'demo' ? (
          <EmptyState title="Sign in to record networks" description="Networks save to your account." />
        ) : networks.length === 0 ? (
          <EmptyState title="No networks recorded" description="Add your main Wi-Fi, any IoT/guest network, and the wired network if you have one." />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {networks.map((network) => (
              <Card key={network.id} style={{ padding: '14px 14px 14px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <div>
                    <strong style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{network.name}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{[formatEnumLabel(network.network_type), network.ssid ? `SSID: ${network.ssid}` : null, network.internet_provider].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {network.is_iot ? <UtilityBadge label="IoT" /> : null}
                    {network.is_guest ? <UtilityBadge label="Guest" /> : null}
                    <ActionLink href={`/automation/networks/${network.id}`} variant="secondary">Open</ActionLink>
                    <Button variant="secondary" onClick={() => remove(network)} style={{ color: 'var(--status-urgent)', borderColor: 'var(--status-urgent)' }}>Remove</Button>
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
