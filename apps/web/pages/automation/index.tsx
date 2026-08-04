import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-folder/shared';
import { Card, EmptyState, PageHeader, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import {
  getAutomationContext,
  getDevicesForContext,
  getHubsForContext,
  getNetworksForContext,
  getRoutinesForContext,
  type AutomationDataMode,
  type AutomationDeviceRow,
  type AutomationHubRow,
  type AutomationNetworkRow,
  type AutomationRoutineRow
} from '../../lib/automation';
import { computeAutomationOverview, type AutomationOverview } from '../../lib/automationOverview';
import { usePropertyAccess } from '../../lib/access';
import { ViewOnlyNotice } from '../../components/ViewOnlyNotice';

function StatTile({ label, value, tone }: { label: string; value: number; tone?: 'urgent' | 'attention' | 'good' }) {
  const color =
    tone === 'urgent' ? 'var(--status-urgent)' : tone === 'attention' ? 'var(--color-brass-deep)' : tone === 'good' ? 'var(--status-good)' : 'var(--text-primary)';
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '12px 14px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color }}>{value}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{label}</div>
    </div>
  );
}

export default function AutomationOverviewPage() {
  const access = usePropertyAccess();
  const [dataMode, setDataMode] = useState<AutomationDataMode>('demo');
  const [devices, setDevices] = useState<AutomationDeviceRow[]>([]);
  const [hubs, setHubs] = useState<AutomationHubRow[]>([]);
  const [networks, setNetworks] = useState<AutomationNetworkRow[]>([]);
  const [routines, setRoutines] = useState<AutomationRoutineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const context = await getAutomationContext();
        const [d, h, n, r] = await Promise.all([
          getDevicesForContext(context),
          getHubsForContext(context),
          getNetworksForContext(context),
          getRoutinesForContext(context)
        ]);
        if (!isMounted) return;
        setDataMode(context.mode);
        setDevices(d);
        setHubs(h);
        setNetworks(n);
        setRoutines(r);
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load automation data.');
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

  const overview: AutomationOverview = useMemo(
    () => computeAutomationOverview({ devices, hubs, networks, routines }),
    [devices, hubs, networks, routines]
  );

  const attention = useMemo(() => {
    const items: string[] = [];
    if (overview.needsAttention > 0) items.push(`${overview.needsAttention} device${overview.needsAttention === 1 ? '' : 's'} need attention`);
    if (overview.lowBattery > 0) items.push(`${overview.lowBattery} low battery`);
    if (overview.offline > 0) items.push(`${overview.offline} offline`);
    if (overview.untestedCriticalRoutines > 0) items.push(`${overview.untestedCriticalRoutines} critical automation${overview.untestedCriticalRoutines === 1 ? '' : 's'} untested`);
    if (overview.brokenRoutines > 0) items.push(`${overview.brokenRoutines} broken automation${overview.brokenRoutines === 1 ? '' : 's'}`);
    if (overview.incompleteSetup > 0) items.push(`${overview.incompleteSetup} incomplete setup`);
    if (overview.noResetInstructions > 0) items.push(`${overview.noResetInstructions} critical device${overview.noResetInstructions === 1 ? '' : 's'} with no reset steps`);
    return items;
  }, [overview]);

  return (
    <>
      <PageHeader
        eyebrow="Section I — The Home"
        title="Smart Home"
        description="Every connected device, how it communicates, what it depends on, and what to do when something fails."
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {access.loading || access.canWrite ? (
            <ActionLink href="/automation/add-device">Add device</ActionLink>
          ) : (
            <ViewOnlyNotice role={access.role} action="add devices" inline />
          )}
          <ActionLink href="/automation/devices" variant="secondary">All devices</ActionLink>
          <ActionLink href="/automation/hubs" variant="secondary">Hubs</ActionLink>
          <ActionLink href="/automation/networks" variant="secondary">Networks</ActionLink>
          <ActionLink href="/automation/automations" variant="secondary">Automations</ActionLink>
          <ActionLink href="/automation/map" variant="secondary">Connection map</ActionLink>
          <ActionLink href="/automation/failure-impact" variant="secondary">What fails if…</ActionLink>
          <ActionLink href="/automation/emergency" variant="secondary">Emergency guide</ActionLink>
          <ActionLink href="/dashboard" variant="secondary">Back to dashboard</ActionLink>
        </div>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        {error ? (
          <Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>{error}</p></Card>
        ) : null}

        {loading ? (
          <Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>Opening your smart home…</p></Card>
        ) : dataMode === 'demo' ? (
          <EmptyState
            title="Sign in to document your smart home"
            description="The Home Automation module saves to your account so it's available during an emergency, sale, or handover. Demo mode does not persist automation data."
          />
        ) : overview.totalDevices === 0 && overview.hubs === 0 && overview.networks === 0 ? (
          <EmptyState
            title="No smart devices recorded yet"
            description="Start with the devices that matter in an emergency — locks, cameras, leak sensors, the thermostat. Add a hub or network first if your devices connect through one."
          />
        ) : (
          <>
            {attention.length > 0 ? (
              <Card tone="dark">
                <h2 style={{ marginTop: 0 }}>Needs your attention</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {attention.map((item) => (
                    <UtilityBadge key={item} label={item} variant="brassPale" />
                  ))}
                </div>
              </Card>
            ) : null}

            <Card>
              <h2 style={{ marginTop: 0 }}>At a glance</h2>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                <StatTile label="Devices" value={overview.totalDevices} />
                <StatTile label="Working" value={overview.online} tone="good" />
                <StatTile label="Offline" value={overview.offline} tone={overview.offline > 0 ? 'urgent' : undefined} />
                <StatTile label="Need attention" value={overview.needsAttention} tone={overview.needsAttention > 0 ? 'attention' : undefined} />
                <StatTile label="Low battery" value={overview.lowBattery} tone={overview.lowBattery > 0 ? 'attention' : undefined} />
                <StatTile label="Critical" value={overview.criticalDevices} />
                <StatTile label="Hubs" value={overview.hubs} />
                <StatTile label="Networks" value={overview.networks} />
                <StatTile label="Automations" value={overview.routines} />
              </div>
            </Card>

            <Card>
              <h2 style={{ marginTop: 0 }}>What works without internet</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <UtilityBadge label={`${overview.localOnly} work locally`} tone="good" />
                <UtilityBadge label={`${overview.cloudDependent} need internet`} tone={overview.cloudDependent > 0 ? 'attention' : 'neutral'} />
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: 0, marginTop: 12, fontSize: 14 }}>
                During an internet outage, cloud-dependent devices stop responding. The emergency guide lists exactly which ones.
              </p>
            </Card>

            {overview.byCategory.length > 0 ? (
              <Card>
                <h2 style={{ marginTop: 0 }}>By type</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {overview.byCategory.slice(0, 12).map((row) => (
                    <UtilityBadge key={row.key} label={`${formatEnumLabel(row.key)}: ${row.count}`} />
                  ))}
                </div>
              </Card>
            ) : null}

            <Card>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Saved to your account.</p>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
