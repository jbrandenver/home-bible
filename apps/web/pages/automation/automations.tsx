import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AUTOMATION_CRITICALITIES,
  AUTOMATION_ROUTINE_TYPES,
  formatEnumLabel,
  type AutomationCriticality,
  type AutomationRoutineType
} from '@home-folder/shared';
import { Button, Card, EmptyState, Input, PageHeader, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import { ViewOnlyNotice } from '../../components/ViewOnlyNotice';
import { usePropertyAccess } from '../../lib/access';
import {
  createRoutineForContext,
  getAutomationContext,
  getRoutinesForContext,
  type AutomationDataContext,
  type AutomationDataMode,
  type AutomationRoutineRow
} from '../../lib/automation';

function statusTone(status: AutomationRoutineRow['status']): 'good' | 'urgent' | 'attention' | 'neutral' {
  if (status === 'active') return 'good';
  if (status === 'broken') return 'urgent';
  if (status === 'untested' || status === 'disabled') return 'attention';
  return 'neutral';
}

export default function AutomationsListPage() {
  const access = usePropertyAccess();
  const [context, setContext] = useState<AutomationDataContext | null>(null);
  const [dataMode, setDataMode] = useState<AutomationDataMode>('demo');
  const [routines, setRoutines] = useState<AutomationRoutineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [routineType, setRoutineType] = useState<AutomationRoutineType>('routine');
  const [criticality, setCriticality] = useState<AutomationCriticality>('normal');
  const [triggerText, setTriggerText] = useState('');
  const [actionsText, setActionsText] = useState('');
  const [internetDependency, setInternetDependency] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const nextContext = await getAutomationContext();
        const list = await getRoutinesForContext(nextContext);
        if (!isMounted) return;
        setContext(nextContext);
        setDataMode(nextContext.mode);
        setRoutines(list);
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load automations.');
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
      setFormError('Give the automation a name first.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const created = await createRoutineForContext(context, {
        name: name.trim(),
        routine_type: routineType,
        criticality,
        status: 'untested',
        trigger_text: triggerText.trim() || null,
        actions_text: actionsText.trim() || null,
        internet_dependency: internetDependency,
        local_control_available: !internetDependency
      });
      setRoutines((current) => [created, ...current].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setTriggerText('');
      setActionsText('');
      setInternetDependency(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to add automation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Smart Home" title="Automations & scenes" description="Routines, scenes, and rules — with triggers, actions, and what happens if they fail.">
        <ActionLink href="/automation" variant="secondary">Overview</ActionLink>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        {dataMode === 'supabase' ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Add an automation</h2>
            {!access.loading && !access.canWrite ? (
              <ViewOnlyNotice role={access.role} action="add automations" inline />
            ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <label><span>Name</span><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lock up at night" style={{ marginTop: 6 }} /></label>
                <label><span>Type</span>
                  <Select value={routineType} onChange={(e) => setRoutineType(e.target.value as AutomationRoutineType)} style={{ marginTop: 6 }}>
                    {AUTOMATION_ROUTINE_TYPES.map((t) => <option key={t} value={t}>{formatEnumLabel(t)}</option>)}
                  </Select>
                </label>
                <label><span>Importance</span>
                  <Select value={criticality} onChange={(e) => setCriticality(e.target.value as AutomationCriticality)} style={{ marginTop: 6 }}>
                    {AUTOMATION_CRITICALITIES.map((c) => <option key={c} value={c}>{formatEnumLabel(c)}</option>)}
                  </Select>
                </label>
              </div>
              <label><span>When this happens (trigger)</span><Input value={triggerText} onChange={(e) => setTriggerText(e.target.value)} placeholder="Everyone leaves / sunset / leak detected" style={{ marginTop: 6 }} /></label>
              <label><span>Do this (actions)</span><Input value={actionsText} onChange={(e) => setActionsText(e.target.value)} placeholder="Lock doors, arm alarm, turn off lights" style={{ marginTop: 6 }} /></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={internetDependency} onChange={(e) => setInternetDependency(e.target.checked)} />
                <span>Needs internet / a cloud service to run</span>
              </label>
              <div><Button onClick={add} disabled={saving}>{saving ? 'Adding…' : 'Add automation'}</Button></div>
            </div>
            )}
            {formError ? <p style={{ color: 'var(--status-urgent)', fontWeight: 700, marginBottom: 0 }}>{formError}</p> : null}
          </Card>
        ) : null}

        {error ? <Card><p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>{error}</p></Card> : null}

        {loading ? (
          <Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading automations…</p></Card>
        ) : dataMode === 'demo' ? (
          <EmptyState title="Sign in to record automations" description="Automations save to your account." />
        ) : routines.length === 0 ? (
          <EmptyState title="No automations recorded" description="Add your routines and scenes — 'lock up at night', 'shut off water on a leak', 'lights at sunset'. Record what triggers each and what it does." />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {routines.map((routine) => (
              <Card key={routine.id} interactive style={{ padding: '14px 14px 14px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
                      <Link href={`/automation/automations/${routine.id}`} style={{ textDecoration: 'none' }}>{routine.name}</Link>
                    </strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 2 }}>
                      {[formatEnumLabel(routine.routine_type), routine.trigger_text ? `When: ${routine.trigger_text}` : null].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <UtilityBadge label={formatEnumLabel(routine.status)} tone={statusTone(routine.status)} />
                    {routine.criticality === 'critical' || routine.criticality === 'high' ? <UtilityBadge label={formatEnumLabel(routine.criticality)} tone="attention" /> : null}
                    {routine.internet_dependency ? <UtilityBadge label="Needs internet" /> : <UtilityBadge label="Works locally" tone="good" />}
                    <ActionLink href={`/automation/automations/${routine.id}`} variant="secondary">Open</ActionLink>
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
