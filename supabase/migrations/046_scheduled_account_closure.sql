-- 046: closing an account can wait for the end of the paid period.
--
-- Until now closing an account deleted it on the spot and cancelled the
-- subscription immediately, which forfeited whatever was left of the period
-- the customer had already paid for. The Stripe portal already cancels
-- `at_period_end`, so the two routes out disagreed, and the in-app one was the
-- less generous of the two.
--
-- Now a subscriber's closure is SCHEDULED for the end of the period they paid
-- for. The account stays fully usable until then — they bought that time — and
-- they can change their mind. Anyone who wants out now can still choose an
-- immediate closure, which matters for privacy requests: a deletion request
-- should not have to wait on a billing convenience.
--
-- Why the processor is plain SQL and not another edge function: scheduling
-- already told Stripe to cancel at period end, so nothing here needs to talk
-- to Stripe. That removes the need for a new cron shared secret and a new
-- deployable surface. Verified that every auth child table (sessions,
-- identities, mfa_factors, one_time_tokens, webauthn_*) is ON DELETE CASCADE,
-- so deleting the auth.users row tears the login down exactly as the admin API
-- did.

create table if not exists public.account_closures (
  user_id uuid primary key references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  -- When the record actually goes. For a subscriber this is the current
  -- period end reported by Stripe, not a guess from today.
  scheduled_for timestamptz not null,
  -- Kept so the closure can be undone: cancelling means telling Stripe to stop
  -- cancelling this exact subscription.
  provider_subscription_id text,
  created_at timestamptz not null default now()
);

comment on table public.account_closures is
  'Pending account closures. A row means "delete this account at scheduled_for". '
  'Written only by the delete-account edge function (service role); the owner '
  'may read their own so the app can show the date and offer to undo.';

create index if not exists account_closures_due_idx
  on public.account_closures (scheduled_for);

alter table public.account_closures enable row level security;

-- Read-only, and only your own. Everything that creates, changes or removes a
-- row goes through an edge function that has already verified the caller and
-- coordinated the Stripe side; letting a client write here directly would let
-- someone schedule (or silently unschedule) a closure without either.
drop policy if exists p12_account_closures_select on public.account_closures;
create policy p12_account_closures_select on public.account_closures
for select using (user_id = (select auth.uid()));

revoke all on public.account_closures from anon, authenticated;
grant select on public.account_closures to authenticated;

-- ---------------------------------------------------------------------------
-- The processor. Runs daily; deletes the accounts whose paid period has ended.
--
-- Mirrors the edge function's teardown in the same order for the same reason:
-- erase the data first, record the audit row while the actor still exists,
-- then remove the login last, so nothing is ever orphaned by a mid-way failure.
-- One transaction per user via the loop, so one bad row cannot strand the rest.
-- ---------------------------------------------------------------------------
create or replace function public.process_due_account_closures()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  closure record;
  summary jsonb;
  processed integer := 0;
begin
  for closure in
    select user_id, scheduled_for
    from public.account_closures
    where scheduled_for <= now()
    order by scheduled_for
    limit 200
  loop
    begin
      select public.delete_account_data(closure.user_id) into summary;

      -- Logged before the login goes: audit_events.actor_user_id is
      -- ON DELETE SET NULL, so afterwards the column could not say who this
      -- was. The id also goes in the payload for the same reason.
      -- Named notation deliberately: log_audit_event takes p_property_id as
      -- its SECOND parameter, so a positional call silently puts the payload
      -- in the wrong slot.
      perform public.log_audit_event(
        p_event_type => 'account.deleted',
        p_payload => jsonb_build_object(
          'user_id', closure.user_id,
          'via', 'scheduled_closure',
          'scheduled_for', closure.scheduled_for
        ) || coalesce(summary, '{}'::jsonb),
        p_severity => 'alert',
        p_actor => closure.user_id
      );

      -- Cascades through the closure row itself.
      delete from auth.users where id = closure.user_id;

      processed := processed + 1;
    exception when others then
      -- One unhappy account must not block every other due closure. The row
      -- stays put and is retried tomorrow.
      perform public.log_audit_event(
        p_event_type => 'account.scheduled_closure_failed',
        p_payload => jsonb_build_object('user_id', closure.user_id, 'error', sqlerrm),
        p_severity => 'alert',
        p_actor => closure.user_id
      );
    end;
  end loop;

  return processed;
end;
$$;

-- Cron calls this as the table owner. No client role may run it: it deletes
-- accounts, and nothing about it should be reachable from the API surface.
revoke all on function public.process_due_account_closures() from public, anon, authenticated;

-- Daily at 04:30 UTC. Unlike the other jobs in this project, which post to an
-- edge function with a shared secret from the vault, this one is a plain SQL
-- call — there is no HTTP hop to authenticate, so there is no secret to leak
-- or rotate.
--
-- The exact time barely matters: `scheduled_for` is the period end Stripe
-- reported, so a closure processed a few hours late simply means the customer
-- keeps their record slightly longer than the minimum. Erring in that
-- direction is correct; erring the other way would delete paid-for time.
--
-- Idempotent: cron.schedule upserts on job name.
select cron.schedule(
  'home-folder-account-closures',
  '30 4 * * *',
  $cron$select public.process_due_account_closures();$cron$
);
