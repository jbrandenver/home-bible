import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { AUTOMATION_CRITICALITIES, AUTOMATION_ROUTINE_STATUSES, formatEnumLabel, type AutomationCriticality, type AutomationRoutineStatus } from '@home-folder/shared';
import { Button, Card, Input, PageHeader, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../../components/ActionLink';
import {
  addRoutineDeviceForContext,
  deleteRoutineForContext,
  getAutomationContext,
  getDevicesForContext,
  getRoutineById,
  getRoutineDeviceLinksForContext,
  removeRoutineDeviceForContext,
  updateRoutineForContext,
  updateRoutineStatusForContext,
  type AutomationDataContext,
  type AutomationDeviceRow,
  type AutomationRoutineRow,
  type RoutineDeviceLink
} from '../../../lib/automation';

const ROLES: Array<{ value: 'trigger' | 'condition' | 'action' | 'involved'; label: string }> = [
  { value: 'trigger', label: 'Trigger' },
  { value: 'condition', label: 'Condition' },
  { value: 'action', label: 'Action' },
  { value: 'involved', label: 'Involved' }
];

export default function AutomationDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const routineId = typeof id === 'string' ? id : '';

  const [context, setContext] = useState<AutomationDataContext | null>(null);
  const [routine, setRoutine] = useState<AutomationRoutineRow | null>(null);
  const [devices, setDevices] = useState<AutomationDeviceRow[]>([]);
  const [links, setLinks] = useState<RoutineDeviceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);

  const [addDeviceId, setAddDeviceId] = useState('');
  const [addRole, setAddRole] = useState<'trigger' | 'condition' | 'action' | 'involved'>('action');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({});

  const reloadLinks = async (ctx: AutomationDataContext) => {
    const all = await getRoutineDeviceLinksForContext(ctx);
    setLinks(all.filter((l) => l.routine_id === routineId));
  };

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!routineId) return;
      setLoading(true);
      setError('');
      try {
        const nextContext = await getAutomationContext();
        const [nextRoutine, deviceList, allLinks] = await Promise.all([
          getRoutineById(nextContext, routineId),
          getDevicesForContext(nextContext),
          getRoutineDeviceLinksForContext(nextContext)
        ]);
        if (!isMounted) return;
        setContext(nextContext);
        setRoutine(nextRoutine);
        setDevices(deviceList);
        setLinks(allLinks.filter((l) => l.routine_id === routineId));
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load automation.');
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
  }, [routineId]);

  const deviceName = useMemo(() => {
    const map = new Map(devices.map((d) => [d.id, d.nickname || d.name]));
    return (deviceId: string) => map.get(deviceId) || 'Unknown device';
  }, [devices]);

  const availableDevices = useMemo(
    () => devices.filter((d) => !links.some((l) => l.device_id === d.id && l.role === addRole)),
    [devices, links, addRole]
  );

  const changeStatus = async (status: AutomationRoutineStatus) => {
    if (!context || !routine) return;
    setActing(true);
    setError('');
    try {
      await updateRoutineStatusForContext(context, routine.id, status);
      setRoutine({ ...routine, status });
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update status.');
    } finally {
      setActing(false);
    }
  };

  const startEdit = () => {
    if (!routine) return;
    setForm({
      criticality: routine.criticality,
      trigger_text: routine.trigger_text || '',
      conditions_text: routine.conditions_text || '',
      actions_text: routine.actions_text || '',
      failure_behavior: routine.failure_behavior || '',
      manual_override: routine.manual_override || '',
      description: routine.description || '',
      platform: routine.platform || '',
      internet_dependency: routine.internet_dependency
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!context || !routine) return;
    setActing(true);
    setError('');
    try {
      const s = (k: string) => (typeof form[k] === 'string' ? (form[k] as string).trim() || null : null);
      const updated = await updateRoutineForContext(context, routine.id, {
        criticality: form.criticality as AutomationCriticality,
        trigger_text: s('trigger_text'),
        conditions_text: s('conditions_text'),
        actions_text: s('actions_text'),
        failure_behavior: s('failure_behavior'),
        manual_override: s('manual_override'),
        description: s('description'),
        platform: s('platform'),
        internet_dependency: Boolean(form.internet_dependency),
        local_control_available: !form.internet_dependency
      });
      if (updated) setRoutine(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save changes.');
    } finally {
      setActing(false);
    }
  };

  const addDevice = async () => {
    if (!context || !routine || !addDeviceId) return;
    setActing(true);
    setError('');
    try {
      await addRoutineDeviceForContext(context, routine.id, addDeviceId, addRole);
      await reloadLinks(context);
      setAddDeviceId('');
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Failed to link device.');
    } finally {
      setActing(false);
    }
  };

  const removeDevice = async (link: RoutineDeviceLink) => {
    if (!context || !routine) return;
    setActing(true);
    try {
      await removeRoutineDeviceForContext(context, routine.id, link.device_id, link.role);
      await reloadLinks(context);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to unlink device.');
    } finally {
      setActing(false);
    }
  };

  const remove = async () => {
    if (!context || !routine) return;
    if (!window.confirm(`Remove the automation "${routine.name}"?`)) return;
    setActing(true);
    try {
      await deleteRoutineForContext(context, routine.id);
      router.push('/automation/automations');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete automation.');
      setActing(false);
    }
  };

  if (loading) {
    return (<><PageHeader title="Automation" /><Card><p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p></Card></>);
  }
  if (error && !routine) {
    return (
      <>
        <PageHeader title="Could not load this automation" />
        <Card>
          <p style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p>
          <ActionLink href="/automation/automations" variant="secondary">Back to automations</ActionLink>
        </Card>
      </>
    );
  }
  if (!routine) {
    return (
      <>
        <PageHeader title="Automation not found" />
        <Card><ActionLink href="/automation/automations" variant="secondary">Back to automations</ActionLink></Card>
      </>
    );
  }

  const byRole = (role: string) => links.filter((l) => l.role === role);

  return (
    <>
      <PageHeader eyebrow="Automation" title={routine.name} description={formatEnumLabel(routine.routine_type)}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <UtilityBadge label={formatEnumLabel(routine.status)} />
          {routine.internet_dependency ? <UtilityBadge label="Needs internet" tone="attention" /> : <UtilityBadge label="Works locally" tone="good" />}
          {routine.criticality === 'critical' || routine.criticality === 'high' ? <UtilityBadge label={formatEnumLabel(routine.criticality)} tone="attention" /> : null}
          {context?.mode === 'supabase' && !editing ? <Button variant="secondary" onClick={startEdit}>Edit</Button> : null}
        </div>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>Status &amp; testing</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Select aria-label="Automation status" value={routine.status} onChange={(e) => changeStatus(e.target.value as AutomationRoutineStatus)} disabled={acting} style={{ maxWidth: 200 }}>
              {AUTOMATION_ROUTINE_STATUSES.map((s) => <option key={s} value={s}>{formatEnumLabel(s)}</option>)}
            </Select>
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{routine.last_tested ? `Last tested ${routine.last_tested}` : 'Never tested'}</span>
          </div>
          {error ? <p style={{ color: 'var(--status-urgent)', fontWeight: 700, marginBottom: 0 }}>{error}</p> : null}
        </Card>

        {editing ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Edit automation</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <label><span>Importance</span><Select value={String(form.criticality ?? '')} onChange={(e) => setForm((f) => ({ ...f, criticality: e.target.value }))} style={{ marginTop: 6 }}>{AUTOMATION_CRITICALITIES.map((c) => <option key={c} value={c}>{formatEnumLabel(c)}</option>)}</Select></label>
                <label><span>Platform</span><Input value={String(form.platform ?? '')} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))} placeholder="Apple Home / Home Assistant" style={{ marginTop: 6 }} /></label>
              </div>
              <label><span>When (trigger)</span><Input value={String(form.trigger_text ?? '')} onChange={(e) => setForm((f) => ({ ...f, trigger_text: e.target.value }))} style={{ marginTop: 6 }} /></label>
              <label><span>Only if (conditions)</span><Input value={String(form.conditions_text ?? '')} onChange={(e) => setForm((f) => ({ ...f, conditions_text: e.target.value }))} style={{ marginTop: 6 }} /></label>
              <label><span>Do (actions)</span><Input value={String(form.actions_text ?? '')} onChange={(e) => setForm((f) => ({ ...f, actions_text: e.target.value }))} style={{ marginTop: 6 }} /></label>
              <label><span>If it fails</span><textarea value={String(form.failure_behavior ?? '')} onChange={(e) => setForm((f) => ({ ...f, failure_behavior: e.target.value }))} style={{ width: '100%', minHeight: 48, marginTop: 6, padding: 10 }} /></label>
              <label><span>Manual override (shown in the emergency guide)</span><textarea value={String(form.manual_override ?? '')} onChange={(e) => setForm((f) => ({ ...f, manual_override: e.target.value }))} style={{ width: '100%', minHeight: 48, marginTop: 6, padding: 10 }} /></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={Boolean(form.internet_dependency)} onChange={(e) => setForm((f) => ({ ...f, internet_dependency: e.target.checked }))} /><span>Needs internet / a cloud service</span></label>
              <div style={{ display: 'flex', gap: 8 }}><Button onClick={saveEdit} disabled={acting}>{acting ? 'Saving…' : 'Save'}</Button><Button variant="secondary" onClick={() => setEditing(false)} disabled={acting}>Cancel</Button></div>
            </div>
          </Card>
        ) : (
          <Card>
            <h2 style={{ marginTop: 0 }}>How it works</h2>
            <div style={{ display: 'grid', gap: 6 }}>
              {routine.trigger_text ? <div><strong>When:</strong> {routine.trigger_text}</div> : null}
              {routine.conditions_text ? <div><strong>Only if:</strong> {routine.conditions_text}</div> : null}
              {routine.actions_text ? <div><strong>Do:</strong> {routine.actions_text}</div> : null}
              {routine.failure_behavior ? <div><strong>If it fails:</strong> {routine.failure_behavior}</div> : null}
              {routine.manual_override ? <div><strong>Manual override:</strong> {routine.manual_override}</div> : null}
              {!routine.trigger_text && !routine.actions_text ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>No trigger or actions recorded yet. Use Edit to add them.</p> : null}
            </div>
          </Card>
        )}

        <Card>
          <h2 style={{ marginTop: 0 }}>Devices involved</h2>
          {ROLES.map((role) => {
            const roleLinks = byRole(role.value);
            if (roleLinks.length === 0) return null;
            return (
              <div key={role.value} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>{role.label}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {roleLinks.map((link) => (
                    <span key={`${link.device_id}-${link.role}`} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '4px 10px' }}>
                      <Link href={`/automation/devices/${link.device_id}`} style={{ textDecoration: 'none' }}>{deviceName(link.device_id)}</Link>
                      <button type="button" onClick={() => removeDevice(link)} disabled={acting} aria-label="Remove" style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--status-urgent)' }}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {links.length === 0 ? <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>No devices linked yet.</p> : null}

          {context?.mode === 'supabase' ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', marginTop: 8 }}>
              <label style={{ flex: '1 1 200px' }}>
                <span>Add device</span>
                <Select value={addDeviceId} onChange={(e) => setAddDeviceId(e.target.value)} style={{ marginTop: 6 }}>
                  <option value="">Choose a device</option>
                  {availableDevices.map((d) => <option key={d.id} value={d.id}>{d.nickname || d.name}</option>)}
                </Select>
              </label>
              <label style={{ flex: '0 1 150px' }}>
                <span>As</span>
                <Select value={addRole} onChange={(e) => setAddRole(e.target.value as typeof addRole)} style={{ marginTop: 6 }}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
              </label>
              <Button variant="secondary" onClick={addDevice} disabled={acting || !addDeviceId}>Link</Button>
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Manage</h2>
          <Button variant="secondary" onClick={remove} disabled={acting} style={{ color: 'var(--status-urgent)', borderColor: 'var(--status-urgent)' }}>
            {acting ? 'Working…' : 'Remove automation'}
          </Button>
        </Card>
      </div>
    </>
  );
}
