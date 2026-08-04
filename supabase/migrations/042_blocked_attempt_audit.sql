-- 042: blocked escalation attempts finally reach the audit trail.
--
-- The guard triggers (015/025) raise exceptions, and a raise rolls back the
-- whole transaction — including any audit row written inside it. So the audit
-- trail recorded only successes; an insider hammering at privilege escalation
-- was invisible (035 documents this honestly as its known limitation).
--
-- The fix is record-then-skip: on violation the guard writes an audit_events
-- row at severity 'alert' and returns NULL, which skips the offending row
-- WITHOUT aborting the transaction. The transaction commits, the audit row
-- survives, and severity 'alert' already feeds the daily security digest
-- (035's security_digest_report) — no new plumbing.
--
-- Why this is safe to change (every legitimate path was traced first):
--   * claim_property_transfer (025) flips properties.owner_user_id under its
--     app.claiming_property_transfer bypass BEFORE touching memberships, so
--     the claimant is already the owner when the member guard evaluates —
--     the guard never fires on a legitimate claim.
--   * accept_property_invitation / accept_pending_invitation insert under
--     app.accepting_property_invitation — bypassed, never fires.
--   * delete_account_data (016) only sets deleted_at; roles and identities
--     are untouched — never fires.
--   So the ONLY behavior that changes is the behavior of requests that
--   previously ERRORED. Those now return zero affected rows; the web client
--   treats zero-row guarded writes as failures with honest messages (the
--   2026-08-04 sharing fixes), so nothing user-facing reads as success.
--
-- Semantics notes, deliberate:
--   * Multi-row statements now skip only the violating rows instead of
--     aborting entirely. Legitimate flows never mix violating and
--     non-violating rows in one statement; for attackers, partial skip plus
--     an alert row beats an abort that left no trace.
--   * The client no longer sees the specific refusal text ("only owners
--     can…") for these cases — it sees its zero-row message instead. That
--     trade buys a durable, digest-visible record of the attempt. The
--     refusal reason still goes to the Postgres log via RAISE WARNING.
--   * Denial NEVER depends on logging: log_blocked_attempt swallows its own
--     failures, and the guard skips the row regardless.

-- Dedupe lookup for the rate cap below.
create index if not exists audit_events_actor_type_created_idx
  on public.audit_events (actor_user_id, event_type, created_at desc);

-- Writer for blocked attempts. Severity 'alert' = lands in the security
-- digest. A per-actor, per-event-type 60-second dedupe window caps what a
-- hostile insider can write here to a bounded trickle, and the digest reads
-- one alert the same as fifty.
create or replace function public.log_blocked_attempt(
  p_event_type text,
  p_property_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.audit_events ae
    where ae.actor_user_id is not distinct from auth.uid()
      and ae.event_type = p_event_type
      and ae.created_at > now() - interval '60 seconds'
  ) then
    return;
  end if;

  insert into public.audit_events (actor_user_id, property_id, event_type, event_payload, severity)
  values (auth.uid(), p_property_id, p_event_type, coalesce(p_payload, '{}'::jsonb), 'alert');
exception when others then
  -- Never let auditing break (or unmask) the denial it is describing.
  raise warning 'log_blocked_attempt failed for %: %', p_event_type, sqlerrm;
end;
$$;

revoke all on function public.log_blocked_attempt(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.log_blocked_attempt(text, uuid, jsonb) to service_role;

-- Property member guard: same conditions as 015, violation now logs + skips.
create or replace function public.guard_property_member_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property uuid;
  v_target uuid;
begin
  v_property := case when tg_op = 'DELETE' then old.property_id else new.property_id end;
  v_target := case when tg_op = 'DELETE' then old.user_id else new.user_id end;

  if tg_op = 'UPDATE' and (
    old.property_id is distinct from new.property_id
    or old.user_id is distinct from new.user_id
  ) then
    perform public.log_blocked_attempt('property_members.identity_change_blocked', old.property_id,
      jsonb_build_object('op', tg_op, 'target_user', old.user_id));
    raise warning 'blocked: membership identity change on property % by %', old.property_id, auth.uid();
    return null;
  end if;

  if tg_op in ('INSERT','UPDATE')
    and new.role in ('owner','co_owner')
    and coalesce(current_setting('app.accepting_property_invitation', true), '') <> 'on'
    and not public.is_property_owner(new.property_id) then
    perform public.log_blocked_attempt('property_members.escalation_blocked', v_property,
      jsonb_build_object('op', tg_op, 'target_user', v_target, 'attempted_role', new.role));
    raise warning 'blocked: % grant of % on property % by %', tg_op, new.role, v_property, auth.uid();
    return null;
  end if;

  if tg_op = 'UPDATE' and old.role in ('owner','co_owner') and new.role not in ('owner','co_owner') and not public.is_property_owner(old.property_id) then
    perform public.log_blocked_attempt('property_members.escalation_blocked', old.property_id,
      jsonb_build_object('op', tg_op, 'target_user', old.user_id, 'old_role', old.role, 'attempted_role', new.role));
    raise warning 'blocked: downgrade of % on property % by %', old.role, old.property_id, auth.uid();
    return null;
  end if;

  if tg_op = 'DELETE' and old.role in ('owner','co_owner') and not public.is_property_owner(old.property_id) then
    perform public.log_blocked_attempt('property_members.escalation_blocked', old.property_id,
      jsonb_build_object('op', tg_op, 'target_user', old.user_id, 'old_role', old.role));
    raise warning 'blocked: removal of % on property % by %', old.role, old.property_id, auth.uid();
    return null;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Owner-column guard: 025's conditions (service_role and transfer-claim
-- bypass preserved verbatim), violation now logs + skips the row update.
-- Note: verified live during the dry run — authenticated holds no UPDATE
-- grant on owner_user_id (033), so a client attempt dies at the grant layer
-- with 42501 before this trigger can fire. This guard is defense-in-depth
-- for grant-privileged contexts only.
create or replace function public.guard_property_owner_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.owner_user_id is distinct from new.owner_user_id
    and auth.role() <> 'service_role'
    and coalesce(current_setting('app.claiming_property_transfer', true), '') <> 'on' then
    perform public.log_blocked_attempt('properties.owner_change_blocked', old.id,
      jsonb_build_object('attempted_owner', new.owner_user_id));
    raise warning 'blocked: owner_user_id change on property % by %', old.id, auth.uid();
    return null;
  end if;
  return new;
end;
$$;

-- Household member guard: 015's conditions, violation now logs + skips.
create or replace function public.guard_household_member_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (
    old.household_id is distinct from new.household_id
    or old.user_id is distinct from new.user_id
  ) then
    perform public.log_blocked_attempt('household_members.identity_change_blocked', null,
      jsonb_build_object('op', tg_op, 'household', old.household_id, 'target_user', old.user_id));
    raise warning 'blocked: household membership identity change on % by %', old.household_id, auth.uid();
    return null;
  end if;

  if tg_op in ('INSERT','UPDATE') and new.role in ('owner','co_owner') and public.current_household_role(new.household_id) <> 'owner' then
    perform public.log_blocked_attempt('household_members.escalation_blocked', null,
      jsonb_build_object('op', tg_op, 'household', new.household_id, 'target_user', new.user_id, 'attempted_role', new.role));
    raise warning 'blocked: % grant of % on household % by %', tg_op, new.role, new.household_id, auth.uid();
    return null;
  end if;

  if tg_op = 'UPDATE' and old.role in ('owner','co_owner') and new.role not in ('owner','co_owner') and public.current_household_role(old.household_id) <> 'owner' then
    perform public.log_blocked_attempt('household_members.escalation_blocked', null,
      jsonb_build_object('op', tg_op, 'household', old.household_id, 'target_user', old.user_id, 'old_role', old.role, 'attempted_role', new.role));
    raise warning 'blocked: downgrade of % on household % by %', old.role, old.household_id, auth.uid();
    return null;
  end if;

  if tg_op = 'DELETE' and old.role in ('owner','co_owner') and public.current_household_role(old.household_id) <> 'owner' then
    perform public.log_blocked_attempt('household_members.escalation_blocked', null,
      jsonb_build_object('op', tg_op, 'household', old.household_id, 'target_user', old.user_id, 'old_role', old.role));
    raise warning 'blocked: removal of % on household % by %', old.role, old.household_id, auth.uid();
    return null;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
