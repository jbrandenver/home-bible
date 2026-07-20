import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-folder/shared';
import { Card, EmptyState, PageHeader, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import {
  distinctCloudServices,
  getAutomationContext,
  getDeviceHubLinksForContext,
  getDeviceNetworkLinksForContext,
  getDevicesForContext,
  getHubsForContext,
  getNetworksForContext,
  getRelationshipsForContext,
  getRoutineDeviceLinksForContext,
  getRoutinesForContext,
  type AutomationDataMode
} from '../../lib/automation';
import { computeFailureImpact, type FailureGraph, type FailureTarget } from '../../lib/failureImpact';

export default function FailureImpactPage() {
  const [dataMode, setDataMode] = useState<AutomationDataMode>('demo');
  const [graph, setGraph] = useState<FailureGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const context = await getAutomationContext();
        const [devices, hubs, networks, routines, routineDevices, deviceHubs, deviceNetworks, relationships] =
          await Promise.all([
            getDevicesForContext(context),
            getHubsForContext(context),
            getNetworksForContext(context),
            getRoutinesForContext(context),
            getRoutineDeviceLinksForContext(context),
            getDeviceHubLinksForContext(context),
            getDeviceNetworkLinksForContext(context),
            getRelationshipsForContext(context)
          ]);
        if (!isMounted) return;
        setDataMode(context.mode);
        setGraph({
          devices,
          hubs,
          networks,
          routines,
          routineDevices: routineDevices.map((l) => ({ routine_id: l.routine_id, device_id: l.device_id })),
          deviceHubs: deviceHubs.map((l) => ({ device_id: l.device_id, hub_id: l.hub_id, is_required: l.is_required })),
          deviceNetworks: deviceNetworks.map((l) => ({ device_id: l.device_id, network_id: l.network_id })),
          relationships
        });
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load smart home data.');
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

  // Build the picker options from recorded data.
  const options = useMemo(() => {
    const list: Array<{ key: string; label: string; target: FailureTarget }> = [];
    list.push({ key: 'internet', label: 'Internet outage', target: { type: 'internet', label: 'Internet' } });
    if (graph) {
      for (const hub of graph.hubs) list.push({ key: `hub:${hub.id}`, label: `Hub: ${hub.name}`, target: { type: 'hub', id: hub.id, label: hub.name } });
      for (const network of graph.networks) list.push({ key: `network:${network.id}`, label: `Network: ${network.name}`, target: { type: 'network', id: network.id, label: network.name } });
      for (const cloud of distinctCloudServices(graph.relationships)) list.push({ key: `cloud:${cloud}`, label: `Cloud service: ${cloud}`, target: { type: 'cloud_service', label: cloud } });
      for (const device of graph.devices.filter((d) => d.status !== 'retired')) list.push({ key: `device:${device.id}`, label: `Device: ${device.nickname || device.name}`, target: { type: 'device', id: device.id, label: device.nickname || device.name } });
    }
    return list;
  }, [graph]);

  const result = useMemo(() => {
    if (!graph || !selection) return null;
    const option = options.find((o) => o.key === selection);
    if (!option) return null;
    return computeFailureImpact(graph, option.target);
  }, [graph, selection, options]);

  return (
    <>
      <PageHeader
        eyebrow="Smart Home"
        title="What stops working if this fails?"
        description="Pick something that could fail — the internet, a hub, a network, a cloud service, or a device — to see exactly what's affected and what still works."
      >
        <ActionLink href="/automation" variant="secondary">Overview</ActionLink>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        {error ? <Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>{error}</p></Card> : null}

        {loading ? (
          <Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p></Card>
        ) : dataMode === 'demo' ? (
          <EmptyState title="Sign in to run a failure check" description="This uses your recorded devices, hubs, and dependencies." />
        ) : (
          <>
            <Card>
              <label style={{ display: 'block' }}>
                <span>Imagine this fails…</span>
                <Select value={selection} onChange={(e) => setSelection(e.target.value)} style={{ marginTop: 6, maxWidth: 480 }}>
                  <option value="">Choose what fails</option>
                  {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </Select>
              </label>
            </Card>

            {result ? (
              <>
                {result.warnings.length > 0 ? (
                  <Card tone="dark">
                    <h2 style={{ marginTop: 0 }}>Impact of {result.target.label} failing</h2>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {result.warnings.map((w, i) => (
                        <p key={i} style={{ margin: 0, color: 'var(--color-brass-pale)', fontWeight: 600 }}>{w}</p>
                      ))}
                    </div>
                  </Card>
                ) : null}

                <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                  <Card>
                    <h2 style={{ marginTop: 0 }}>Devices affected ({result.affectedDevices.length})</h2>
                    {result.affectedDevices.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', margin: 0 }}>No recorded devices depend on this.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {result.affectedDevices.map((d) => (
                          <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4 }}>
                            <Link href={`/automation/devices/${d.id}`} style={{ textDecoration: 'none' }}>{d.nickname || d.name}</Link>
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{formatEnumLabel(d.category)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card>
                    <h2 style={{ marginTop: 0 }}>Automations that stop ({result.affectedAutomations.length})</h2>
                    {result.affectedAutomations.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', margin: 0 }}>None recorded.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {result.affectedAutomations.map((r) => (
                          <Link key={r.id} href={`/automation/automations/${r.id}`} style={{ textDecoration: 'none' }}>{r.name}</Link>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>

                {result.safetyAffected.length > 0 || result.securityAffected.length > 0 ? (
                  <Card>
                    <h2 style={{ marginTop: 0 }}>Safety &amp; security</h2>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {result.safetyAffected.map((d) => <UtilityBadge key={d.id} label={`Safety: ${d.nickname || d.name}`} tone="urgent" />)}
                      {result.securityAffected.map((d) => <UtilityBadge key={d.id} label={`Security: ${d.nickname || d.name}`} tone="urgent" />)}
                    </div>
                  </Card>
                ) : null}

                <Card>
                  <h2 style={{ marginTop: 0 }}>Still works (manual alternatives)</h2>
                  {result.stillWorks.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>No devices are recorded as working independently of this.</p>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {result.stillWorks.slice(0, 20).map((d) => <UtilityBadge key={d.id} label={d.nickname || d.name} tone="good" />)}
                    </div>
                  )}
                </Card>

                {result.recoverySteps.length > 0 ? (
                  <Card>
                    <h2 style={{ marginTop: 0 }}>Recovery steps</h2>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {result.recoverySteps.map((step, i) => <li key={i} style={{ marginBottom: 6 }}>{step}</li>)}
                    </ul>
                  </Card>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
