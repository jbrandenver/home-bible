-- 035: enforce the paid boundary in Postgres, and make the app observable.
--
-- Follow-up to the 2026-08-04 audit, closing the items 033 deliberately left
-- alone. Jesse has since ruled that the "enforcement lag" recorded in
-- docs/PRICING_AND_PLANS.md is over, so the property allowance becomes a
-- database rule rather than a React conditional.
--
-- 1. Property allowance enforced on INSERT (grandfathering every existing row).
-- 2. additional_home entitlements count per home instead of unlocking all homes.
-- 3. Stripe buyer resolution requires a CONFIRMED email.
-- 4. audit_events gains a severity and starts being written by the RPCs that
--    perform irreversible actions.
-- 5. A security digest query + the alerting hook, on infrastructure already
--    running (pg_cron + pg_net + the existing Resend sender). No new service.

-- ---------------------------------------------------------------------------
-- 1 + 2. The paid boundary.
--
-- Until now `properties` INSERT checked only `owner_user_id = auth.uid()`, so
-- a free account could POST to /rest/v1/properties in a loop and use the whole
-- Portfolio feature set for nothing. The allowance now lives here, where the
-- anon key cannot route around it:
--
--   free            -> FREE_PROPERTY_ALLOWANCE top-level homes
--   + additional_home -> one extra home per ACTIVE subscription (this is the
--                        fix for that product granting unlimited homes: an
--                        entitlement with a null property_id used to satisfy
--                        has_entitlement for every property, so one $4.99
--                        subscription covered fifty homes)
--   + portfolio_plan  -> unlimited
--
-- Units (parent_property_id is not null) are part of their building and do not
-- consume the allowance; the building itself already counted.
--
-- Deliberately INSERT-only: existing rows are never re-checked, so nobody who
-- is already over the line loses access to a home they created. One account
-- currently holds three top-level homes on the free tier and keeps all three.
-- Ownership transfers move properties by UPDATE, so a claim is never blocked
-- mid-handover.
-- ---------------------------------------------------------------------------

create or replace function public.free_property_allowance()
returns integer
language sql
immutable
as $$
  -- Mirrors FREE_PROPERTY_ALLOWANCE in apps/web/lib/entitlements.ts.
  -- Keep the two in step; the client value only decides when the UI offers an
  -- upgrade, this one decides what the database permits.
  select 2;
$$;

create or replace function public.property_allowance_for(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.entitlements e
      where e.user_id = p_user_id
        and e.product_key = 'portfolio_plan'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    ) then 2147483647
    else public.free_property_allowance() + (
      select count(*)::int
      from public.entitlements e
      where e.user_id = p_user_id
        and e.product_key = 'additional_home'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  end;
$$;

revoke all on function public.property_allowance_for(uuid) from public, anon;
grant execute on function public.property_allowance_for(uuid) to authenticated, service_role;

create or replace function public.enforce_property_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned integer;
  allowance integer;
begin
  -- Units belong to their building; only top-level homes consume allowance.
  if new.parent_property_id is not null then
    return new;
  end if;

  -- Server-side flows (transfer claims, account restores, admin repair) are
  -- not customer purchases and must not be blocked.
  if auth.role() = 'service_role'
     or coalesce(current_setting('app.claiming_property_transfer', true), '') = 'on' then
    return new;
  end if;

  select count(*) into owned
  from public.properties p
  where p.owner_user_id = new.owner_user_id
    and p.deleted_at is null
    and p.parent_property_id is null;

  allowance := public.property_allowance_for(new.owner_user_id);

  if owned >= allowance then
    raise exception
      'This account already has % of % homes. Add another home on the Portfolio plan, or add a single home subscription.',
      owned, allowance
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists properties_enforce_allowance on public.properties;
create trigger properties_enforce_allowance
before insert on public.properties
for each row execute function public.enforce_property_allowance();

-- ---------------------------------------------------------------------------
-- 3. Stripe buyer resolution must require a CONFIRMED address.
--
-- 033 moved the webhook's email fallback off the client-writable
-- profiles.email and onto auth.users. That is necessary but not sufficient:
-- the project currently runs with mailer_autoconfirm ON, so an address in
-- auth.users has not necessarily been proven. Requiring email_confirmed_at
-- closes the hijack for good, and fails safe (the purchase lands in
-- unmatched_purchases for a human) rather than crediting the wrong account.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_user_id_by_verified_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(p_email)
    and u.deleted_at is null
    and u.email_confirmed_at is not null
  limit 1;
$$;

revoke all on function public.resolve_user_id_by_verified_email(text) from public, anon, authenticated;
grant execute on function public.resolve_user_id_by_verified_email(text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. An audit trail that actually gets written.
--
-- audit_events existed since 002 and nothing ever wrote to it, so an
-- irreversible action — an ownership transfer, a deletion — left no trace.
-- 033 revoked client INSERT so the trail cannot be forged; this adds the
-- writer and calls it from the RPCs that do the irreversible things.
--
-- Honest limitation: blocked escalation attempts are NOT recorded here. The
-- guard triggers raise an exception, which rolls back the whole transaction
-- including any audit row written inside it. Durable denial logging needs an
-- out-of-transaction channel; the guards still log to the Postgres log.
-- ---------------------------------------------------------------------------

alter table public.audit_events
  add column if not exists severity text not null default 'info';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audit_events_severity_check'
  ) then
    alter table public.audit_events
      add constraint audit_events_severity_check
      check (severity in ('info','notice','alert'));
  end if;
end $$;

create index if not exists audit_events_severity_created_idx
  on public.audit_events (severity, created_at desc);

create or replace function public.log_audit_event(
  p_event_type text,
  p_property_id uuid default null,
  p_payload jsonb default '{}'::jsonb,
  p_severity text default 'info',
  p_actor uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (actor_user_id, property_id, event_type, event_payload, severity)
  values (coalesce(p_actor, auth.uid()), p_property_id, p_event_type, coalesce(p_payload,'{}'::jsonb), p_severity);
exception when others then
  -- Never let auditing break the action it is describing.
  raise warning 'log_audit_event failed for %: %', p_event_type, sqlerrm;
end;
$$;

revoke all on function public.log_audit_event(text, uuid, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.log_audit_event(text, uuid, jsonb, text, uuid) to service_role;

-- Wire the writer into the irreversible flows, without changing their logic.

create or replace function public.claim_property_transfer(transfer_code text)
returns table(claimed_property_id uuid, claimed_property_nickname text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  xfer public.property_transfers%rowtype;
  prop public.properties%rowtype;
  claimant uuid;
  claimant_email text;
  claimant_household uuid;
begin
  claimant := auth.uid();
  if claimant is null then
    raise exception 'not signed in';
  end if;

  select * into xfer
  from public.property_transfers
  where code_hash = encode(extensions.digest(coalesce(transfer_code, ''), 'sha256'), 'hex')
    and deleted_at is null
  for update;

  if not found then
    raise exception 'this transfer code is not valid';
  end if;
  if xfer.claimed_at is not null then
    raise exception 'this transfer has already been claimed';
  end if;
  if xfer.revoked_at is not null then
    raise exception 'this transfer has been revoked';
  end if;
  if xfer.expires_at < now() then
    raise exception 'this transfer code has expired';
  end if;
  if xfer.issuer_user_id = claimant then
    raise exception 'you cannot claim your own transfer';
  end if;

  if xfer.recipient_email is not null then
    claimant_email := lower(coalesce(auth.jwt() ->> 'email', ''));
    if claimant_email <> xfer.recipient_email then
      raise exception 'this transfer is reserved for a different email address';
    end if;
  end if;

  select * into prop
  from public.properties
  where id = xfer.property_id and deleted_at is null
  for update;

  if not found then
    raise exception 'the property behind this transfer no longer exists';
  end if;

  if prop.owner_user_id <> xfer.issuer_user_id then
    raise exception 'this transfer is no longer valid';
  end if;

  select id into claimant_household
  from public.households
  where owner_user_id = claimant and deleted_at is null
  order by created_at asc
  limit 1;

  if claimant_household is null then
    insert into public.households (owner_user_id, name)
    values (claimant, 'My Household')
    returning id into claimant_household;

    insert into public.household_members (household_id, user_id, role)
    values (claimant_household, claimant, 'owner')
    on conflict (household_id, user_id) do nothing;
  end if;

  perform set_config('app.claiming_property_transfer', 'on', true);

  update public.properties
  set owner_user_id = claimant, household_id = claimant_household
  where id = prop.id;

  update public.properties
  set owner_user_id = claimant, household_id = claimant_household
  where parent_property_id = prop.id and deleted_at is null;

  perform set_config('app.claiming_property_transfer', '', true);

  update public.property_members
  set deleted_at = now()
  where deleted_at is null
    and user_id <> claimant
    and property_members.property_id in (
      select id from public.properties
      where (id = prop.id or parent_property_id = prop.id)
    );

  insert into public.property_members (property_id, user_id, role)
  select p.id, claimant, 'owner'
  from public.properties p
  where (p.id = prop.id or p.parent_property_id = prop.id) and p.deleted_at is null
  on conflict (property_id, user_id)
  do update set role = 'owner', deleted_at = null;

  if xfer.keep_issuer_role is not null then
    insert into public.property_members (property_id, user_id, role)
    select p.id, xfer.issuer_user_id, xfer.keep_issuer_role
    from public.properties p
    where (p.id = prop.id or p.parent_property_id = prop.id) and p.deleted_at is null
    on conflict (property_id, user_id)
    do update set role = excluded.role, deleted_at = null;
  end if;

  update public.property_invitations
  set revoked_at = now()
  where deleted_at is null
    and accepted_at is null
    and revoked_at is null
    and property_invitations.property_id in (
      select id from public.properties
      where (id = prop.id or parent_property_id = prop.id)
    );

  update public.property_transfers
  set claimed_at = now(), claimed_by = claimant
  where id = xfer.id;

  -- An entire home record has just changed hands, irreversibly.
  perform public.log_audit_event(
    'transfer.claimed',
    prop.id,
    jsonb_build_object('issuer_user_id', xfer.issuer_user_id, 'transfer_id', xfer.id),
    'alert',
    claimant
  );

  return query
  select prop.id, prop.nickname;
end;
$function$;

-- Signature, return type, ownership rule and error strings are unchanged from
-- 030 — this only adds the audit write. (The return type is integer and
-- CREATE OR REPLACE cannot change that, so it must be reproduced exactly.)
create or replace function public.delete_property_as_owner(p_property_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  affected integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to delete a home.';
  end if;

  update public.properties
     set deleted_at = now()
   where id = p_property_id
     and owner_user_id = auth.uid()
     and deleted_at is null;
  get diagnostics affected = row_count;

  if affected = 0 then
    raise exception 'Only the person who created this home can delete it.';
  end if;

  update public.properties
     set deleted_at = now()
   where parent_property_id = p_property_id
     and owner_user_id = auth.uid()
     and deleted_at is null;

  perform public.log_audit_event('property.deleted', p_property_id, '{}'::jsonb, 'alert');

  return affected;
end;
$function$;

revoke all on function public.delete_property_as_owner(uuid) from public, anon;
grant execute on function public.delete_property_as_owner(uuid) to authenticated;

create or replace function public.archive_property_as_owner(p_property_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  if not public.is_property_owner_or_co_owner(p_property_id) then
    raise exception 'only the owner can archive this home';
  end if;

  update public.properties
     set archived_at = now()
   where (id = p_property_id or parent_property_id = p_property_id)
     and deleted_at is null;

  perform public.log_audit_event('property.archived', p_property_id, '{}'::jsonb, 'notice');
end;
$$;

revoke all on function public.archive_property_as_owner(uuid) from public, anon;
grant execute on function public.archive_property_as_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The daily security digest.
--
-- Returns only things worth waking someone for. An empty result means healthy,
-- and the sender stays silent — so a delivered email always means something
-- needs a human. Runs on pg_cron + pg_net + the Resend account already in use:
-- no Sentry, no Logtail, no new vendor, no usage billing.
-- ---------------------------------------------------------------------------

create or replace function public.security_digest_report(p_since interval default interval '24 hours')
returns table (category text, detail text, occurred_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select 'unmatched_purchase',
         'Money taken with no account to credit: ' || coalesce(up.customer_email, 'unknown email')
           || ' / ' || coalesce(up.product_key, 'unknown product'),
         up.created_at
  from public.unmatched_purchases up
  where up.created_at > now() - p_since
    and up.resolved_at is null

  union all
  select 'failed_digest',
         'Digest send failed for user ' || dl.user_id::text,
         dl.created_at
  from public.digest_log dl
  where dl.created_at > now() - p_since
    and dl.status = 'failed'

  union all
  select 'audit_alert',
         ae.event_type || ' by ' || coalesce(ae.actor_user_id::text, 'unknown'),
         ae.created_at
  from public.audit_events ae
  where ae.created_at > now() - p_since
    and ae.severity = 'alert'

  union all
  select 'recall_monitoring_stalled',
         'No successful recall run in 48h — recall monitoring may be down',
         now()
  where not exists (
    select 1 from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
    where j.jobname = 'home-folder-check-recalls'
      and d.status = 'succeeded'
      and d.end_time > now() - interval '48 hours'
  )

  order by 3 desc;
$$;

revoke all on function public.security_digest_report(interval) from public, anon, authenticated;
grant execute on function public.security_digest_report(interval) to service_role;
