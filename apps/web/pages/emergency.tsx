import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-folder/shared';
import { Button, Card, PageHeader, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { getCurrentUser } from '../lib/auth';
import {
  describeSnapshotAge,
  readEmergencySnapshot,
  saveEmergencySnapshot,
  withTimeout,
  type EmergencySheetIssue,
  type EmergencySheetUtility,
  type EmergencySnapshot
} from '../lib/emergencySheet';
import { getIssueDataContext, getIssuesForContext, type IssueRow } from '../lib/issues';
import { getUtilityDataContext, getUtilitiesForContext, type UtilityDataContext, type UtilityRow } from '../lib/utilities';

// Deliberately short. This page is read while something is going wrong, so a
// slightly stale saved copy shown in seconds beats live data that may never
// arrive. Both are ceilings, not delays — a fast network is unaffected.
const IDENTITY_TIMEOUT_MS = 2500;
const DATA_TIMEOUT_MS = 6000;

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
  // Set only when the live load failed and the saved copy stood in for it.
  // Holding the snapshot separately keeps the live rows honestly typed as
  // UtilityRow/IssueRow instead of being cast into a shape they do not have.
  const [fallback, setFallback] = useState<EmergencySnapshot | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadEmergencyData() {
      setLoading(true);
      setError('');

      // Resolved up front so it is available on both the success path (to key
      // the snapshot) and the failure path (to find it again). Bounded: an
      // unreachable auth endpoint must not decide whether this page renders,
      // and an anonymous read of the saved copy beats no page at all.
      const user = await withTimeout(getCurrentUser(), IDENTITY_TIMEOUT_MS, null);
      const userId = user?.id ?? null;

      try {
        // Bounded for the same reason: captive-portal wifi and a phone just
        // off airplane mode both produce hangs rather than errors, and a
        // browser fetch has no timeout of its own. Rejecting on timeout is
        // what routes us into the saved copy below.
        const live = await withTimeout(
          (async () => {
            const utilityContext = await getUtilityDataContext();
            const issueContext = await getIssueDataContext();
            const [loadedUtilities, loadedIssues] = await Promise.all([
              getUtilitiesForContext(utilityContext),
              getIssuesForContext(issueContext)
            ]);
            return { utilityContext, loadedUtilities, loadedIssues };
          })(),
          DATA_TIMEOUT_MS,
          null
        );

        if (!live) {
          throw new Error('Emergency data took too long to load.');
        }

        const { utilityContext, loadedUtilities: nextUtilities, loadedIssues: nextIssues } = live;

        if (isMounted) {
          setContext(utilityContext);
          setUtilities(nextUtilities);
          setIssues(nextIssues);
          setFallback(null);
        }

        // Persist the sheet for the next load that cannot reach the network.
        // Deliberately stores the filtered emergency set rather than
        // everything: this is a safety card, not an offline mirror of the app.
        saveEmergencySnapshot(userId, {
          propertyName: utilityContext.property?.nickname ?? null,
          utilities: nextUtilities
            .filter((utility) => emergencyUtilityTypes.has(utility.utility_type))
            .map((utility) => ({
              id: utility.id,
              name: utility.name,
              utility_type: utility.utility_type,
              location_notes: utility.location_notes,
              emergency_notes: utility.emergency_notes
            })),
          issues: nextIssues
            .filter(
              (issue) =>
                issue.severity === 'urgent' && issue.status !== 'resolved' && issue.status !== 'dismissed'
            )
            .map((issue) => ({
              id: issue.id,
              title: issue.title,
              issue_type: issue.issue_type,
              status: issue.status,
              description: issue.description
            }))
        });
      } catch (loadError) {
        // The whole point of the snapshot: a failed load here usually means no
        // network, and no network is the likeliest state during the emergency
        // this page is for. Fall back to the saved copy before reporting an
        // error, and only show a bare error if there is nothing saved.
        const snapshot = readEmergencySnapshot(userId);
        if (!isMounted) {
          return;
        }

        if (snapshot) {
          setFallback(snapshot);
          setError('');
        } else {
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

  const printSheet = useCallback(() => {
    window.print();
  }, []);

  // Both sources collapse to one render shape, so the page below has a single
  // path whether it is showing live data or the saved copy. The snapshot was
  // already filtered when it was written, hence no re-filtering here.
  const emergencyUtilities = useMemo<EmergencySheetUtility[]>(() => {
    if (fallback) {
      return fallback.utilities;
    }
    return utilities
      .filter((utility) => emergencyUtilityTypes.has(utility.utility_type))
      .map((utility) => ({
        id: utility.id,
        name: utility.name,
        utility_type: utility.utility_type,
        location_notes: utility.location_notes,
        emergency_notes: utility.emergency_notes
      }));
  }, [fallback, utilities]);

  const urgentIssues = useMemo<EmergencySheetIssue[]>(() => {
    if (fallback) {
      return fallback.issues;
    }
    return issues
      .filter(
        (issue) => issue.severity === 'urgent' && issue.status !== 'resolved' && issue.status !== 'dismissed'
      )
      .map((issue) => ({
        id: issue.id,
        title: issue.title,
        issue_type: issue.issue_type,
        status: issue.status,
        description: issue.description
      }));
  }, [fallback, issues]);

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
            {(fallback?.propertyName ?? context?.property?.nickname) ? (
              <UtilityBadge label={(fallback?.propertyName ?? context?.property?.nickname) as string} />
            ) : null}
            <UtilityBadge label={`${emergencyUtilities.length} emergency item${emergencyUtilities.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${urgentIssues.length} urgent issue${urgentIssues.length === 1 ? '' : 's'}`} />
          </div>
          {loading ? <p style={{ color: 'rgba(255,248,234,0.78)' }}>Loading emergency details...</p> : null}
          {error ? <p style={{ color: 'var(--text-inverse)', fontWeight: 700 }}>{error}</p> : null}
          {/* Never silently pass a cached copy off as live: during an
              emergency, "is this current?" is the first question worth
              answering, and a shutoff added yesterday might be missing. */}
          {fallback ? (
            <p style={{ color: 'var(--text-inverse)', fontWeight: 700, marginBottom: 0 }}>
              Offline — showing your saved copy, {describeSnapshotAge(fallback.savedAt)}. Anything
              added since then is not here.
            </p>
          ) : null}
        </Card>

        {/* Paper survives a dead battery, a dead router and a locked phone.
            Printed from whatever is on screen, so it works offline too. */}
        <Card className="print-hide">
          <h2 style={{ marginTop: 0 }}>Keep a copy that works without a phone</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Print this sheet and put it on the utility cupboard door. In a real emergency the
            person who needs it may not be you, may not be signed in, and may not have signal.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button type="button" onClick={printSheet}>
              Print / save to PDF
            </Button>
            <ActionLink href="/utilities" variant="secondary">Add a shutoff location</ActionLink>
          </div>
        </Card>

        {/* Print-only heading: the printed page loses the app chrome, so it
            needs to say what it is and when it was true. */}
        <div className="print-only">
          <h1 style={{ margin: '0 0 4px' }}>
            Emergency sheet{fallback?.propertyName ?? context?.property?.nickname
              ? ` — ${fallback?.propertyName ?? context?.property?.nickname}`
              : ''}
          </h1>
          <p style={{ margin: 0 }}>Shutoffs, panels, detectors, and urgent open issues.</p>
        </div>

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
                  {/* A tap target is meaningless on paper, and offline it
                      would lead to the offline page. */}
                  {fallback ? null : (
                    <ActionLink href={`/issues/${issue.id}`} variant="secondary" className="print-hide">
                      Open issue
                    </ActionLink>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
