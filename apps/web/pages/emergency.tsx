import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-folder/shared';
import { Card, PageHeader, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { getIssueDataContext, getIssuesForContext, type IssueRow } from '../lib/issues';
import { getUtilityDataContext, getUtilitiesForContext, type UtilityDataContext, type UtilityRow } from '../lib/utilities';

const emergencyUtilityTypes = new Set([
  'main_water_shutoff',
  'gas_shutoff',
  'electrical_panel',
  'breaker_panel',
  'sump_pump',
  'smoke_detector',
  'carbon_monoxide_detector'
]);

export default function EmergencyPage() {
  const [context, setContext] = useState<UtilityDataContext | null>(null);
  const [utilities, setUtilities] = useState<UtilityRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadEmergencyData() {
      setLoading(true);
      setError('');

      try {
        const utilityContext = await getUtilityDataContext();
        const issueContext = await getIssueDataContext();
        const [nextUtilities, nextIssues] = await Promise.all([
          getUtilitiesForContext(utilityContext),
          getIssuesForContext(issueContext)
        ]);

        if (isMounted) {
          setContext(utilityContext);
          setUtilities(nextUtilities);
          setIssues(nextIssues);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load emergency overview.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadEmergencyData();

    return () => {
      isMounted = false;
    };
  }, []);

  const emergencyUtilities = useMemo(
    () => utilities.filter((utility) => emergencyUtilityTypes.has(utility.utility_type)),
    [utilities]
  );
  const urgentIssues = useMemo(
    () => issues.filter((issue) => issue.severity === 'urgent' && issue.status !== 'resolved' && issue.status !== 'dismissed'),
    [issues]
  );

  return (
    <>
      <PageHeader
        title="Emergency"
        description="One place for shutoffs, panels, detectors, and urgent open issues."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card tone="dark">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <UtilityBadge label={context?.mode === 'supabase' ? 'Saved home data' : 'Demo data'} />
            {context?.property ? <UtilityBadge label={context.property.nickname} /> : null}
            <UtilityBadge label={`${emergencyUtilities.length} emergency item${emergencyUtilities.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${urgentIssues.length} urgent issue${urgentIssues.length === 1 ? '' : 's'}`} />
          </div>
          {loading ? <p style={{ color: 'rgba(255,248,234,0.78)' }}>Loading emergency details...</p> : null}
          {error ? <p style={{ color: 'var(--text-inverse)', fontWeight: 700 }}>{error}</p> : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Shutoffs and Safety</h2>
          {emergencyUtilities.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No emergency utility locations documented yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {emergencyUtilities.map((utility) => (
                <div key={utility.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                  <strong>{utility.name}</strong>
                  <div style={{ color: 'var(--text-muted)' }}>{formatEnumLabel(utility.utility_type)}</div>
                  {utility.location_notes ? <p>{utility.location_notes}</p> : null}
                  {utility.emergency_notes ? <p style={{ fontWeight: 700 }}>{utility.emergency_notes}</p> : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Urgent Open Issues</h2>
          {urgentIssues.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No urgent open issues.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {urgentIssues.map((issue) => (
                <div key={issue.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                  <strong>{issue.title}</strong>
                  <div style={{ color: 'var(--text-muted)' }}>{formatEnumLabel(issue.issue_type)} · {formatEnumLabel(issue.status)}</div>
                  {issue.description ? <p>{issue.description}</p> : null}
                  <ActionLink href={`/issues/${issue.id}`} variant="secondary">Open issue</ActionLink>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
