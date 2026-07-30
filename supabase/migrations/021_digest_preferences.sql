-- Reminder digests: preferences, delivery log, and the payload builder.
--
-- WHY MONTHLY IS THE DEFAULT
-- The app's own dashboard digest already looks 14 days ahead for reminders,
-- 30 for the next service date, and 60 for warranty expiry. That is a monthly
-- horizon, not a weekly one — and it matches how home maintenance actually
-- works: filters quarterly, gutters twice a year, HVAC service annually.
-- A weekly email about a gutter clean due in six weeks is noise, and noise
-- gets unsubscribed, which kills the only channel that brings people back.
--
-- Monthly has one failure mode: something created on the 5th and due on the
-- 10th would never be emailed, because the next send is the 1st. Two things
-- close that gap:
--   1. The monthly digest looks 35 days ahead, not 30, so consecutive sends
--      overlap rather than leaving a hole.
--   2. A scheduled technician visit is the one genuinely short-fuse item, so
--      it gets its own next-day nudge regardless of digest frequency.
--
-- Everything here works with no email provider configured. The payload builder
-- is plain SQL and can be tested today; only the sending needs a key.

create table if not exists public.digest_preferences (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  frequency        text not null default 'monthly'
                     check (frequency in ('off', 'weekly', 'monthly')),
  -- IANA zone, so the send lands at a civilised local hour rather than 3am.
  time_zone        text not null default 'UTC',
  -- Separate from the digest: a nudge the day before a technician is due.
  visit_reminders  boolean not null default true,
  last_sent_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint digest_time_zone_len check (char_length(time_zone) <= 64)
);

alter table public.digest_preferences enable row level security;

-- A user manages their own preferences and nothing else. There is deliberately
-- no delete policy: rows go when the account goes, via the cascade.
drop policy if exists digest_preferences_select_own on public.digest_preferences;
create policy digest_preferences_select_own on public.digest_preferences
for select using ((select auth.uid()) = user_id);

drop policy if exists digest_preferences_insert_own on public.digest_preferences;
create policy digest_preferences_insert_own on public.digest_preferences
for insert with check ((select auth.uid()) = user_id);

drop policy if exists digest_preferences_update_own on public.digest_preferences;
create policy digest_preferences_update_own on public.digest_preferences
for update using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop trigger if exists digest_preferences_set_updated_at on public.digest_preferences;
create trigger digest_preferences_set_updated_at
before update on public.digest_preferences
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Delivery log. Service-role only: it records who was emailed and when, which
-- is neither the user's business to write nor anyone else's to read.
-- Doubles as the idempotency guard — one send per user per period.
-- ---------------------------------------------------------------------------
create table if not exists public.digest_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('digest', 'visit_reminder')),
  period_key    text not null,
  item_count    integer not null default 0,
  status        text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  detail        text,
  created_at    timestamptz not null default now(),
  unique (user_id, kind, period_key)
);

alter table public.digest_log enable row level security;
-- No policies at all: only the service role, which bypasses RLS, touches this.
revoke all on public.digest_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The payload builder.
--
-- Returns exactly what belongs in an email and nothing else. The omissions are
-- deliberate and are the most important part of this function — see the note
-- below the definition.
-- ---------------------------------------------------------------------------
create or replace function public.build_user_digest(
  target_user_id uuid,
  horizon_days integer default 35
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with prop as (
    select id, nickname
    from public.properties
    where owner_user_id = target_user_id and deleted_at is null
    order by created_at asc
    limit 1
  ),
  due_reminders as (
    select
      r.title,
      r.due_date,
      (r.due_date - current_date) as days_out
    from public.reminders r
    join prop on prop.id = r.property_id
    where r.deleted_at is null
      and r.status = 'open'
      and r.due_date is not null
      and r.due_date <= current_date + horizon_days
    order by r.due_date asc
    limit 10
  ),
  upcoming_visits as (
    select
      rep.title,
      rep.scheduled_date,
      rep.scheduled_window,
      (rep.scheduled_date - current_date) as days_out
    from public.repairs rep
    join prop on prop.id = rep.property_id
    where rep.deleted_at is null
      and rep.status in ('open', 'scheduled', 'in_progress')
      and rep.scheduled_date is not null
      and rep.scheduled_date between current_date and current_date + horizon_days
    order by rep.scheduled_date asc
    limit 5
  ),
  expiring_warranties as (
    select
      a.name,
      a.warranty_expires_at,
      (a.warranty_expires_at::date - current_date) as days_out
    from public.assets a
    join prop on prop.id = a.property_id
    where a.deleted_at is null
      and a.warranty_expires_at is not null
      and a.warranty_expires_at::date between current_date and current_date + 60
    order by a.warranty_expires_at asc
    limit 5
  ),
  due_service as (
    select
      s.service_title,
      s.next_service_date,
      (s.next_service_date - current_date) as days_out
    from public.service_records s
    join prop on prop.id = s.property_id
    where s.deleted_at is null
      and s.next_service_date is not null
      and s.next_service_date <= current_date + horizon_days
    order by s.next_service_date asc
    limit 5
  )
  select jsonb_build_object(
    'generated_at', now(),
    'horizon_days', horizon_days,
    -- NOTE: the property NICKNAME only. Never the address. See below.
    'home', coalesce((select nickname from prop), 'your home'),
    'reminders', coalesce((select jsonb_agg(jsonb_build_object(
        'title', title, 'due_date', due_date, 'days_out', days_out
      )) from due_reminders), '[]'::jsonb),
    'visits', coalesce((select jsonb_agg(jsonb_build_object(
        'title', title, 'date', scheduled_date, 'window', scheduled_window, 'days_out', days_out
      )) from upcoming_visits), '[]'::jsonb),
    'warranties', coalesce((select jsonb_agg(jsonb_build_object(
        'name', name, 'expires_at', warranty_expires_at, 'days_out', days_out
      )) from expiring_warranties), '[]'::jsonb),
    'service', coalesce((select jsonb_agg(jsonb_build_object(
        'title', service_title, 'due_date', next_service_date, 'days_out', days_out
      )) from due_service), '[]'::jsonb),
    'item_count',
      (select count(*) from due_reminders)
      + (select count(*) from upcoming_visits)
      + (select count(*) from expiring_warranties)
      + (select count(*) from due_service)
  );
$$;

comment on function public.build_user_digest(uuid, integer) is
$c$Digest payload for one user.

WHAT THIS DELIBERATELY DOES NOT RETURN, and why:

Email is unencrypted in transit, syncs to every device the recipient owns, is
indexed by their provider, and previews on a lock screen. A list of someone's
home maintenance is a burglary reconnaissance document. So the payload carries
titles, dates and counts — and never:

  * the property address, or anything identifying which home it is
  * appliance brands, models or serial numbers (asset NAME only, and only for
    a warranty that is actually expiring)
  * contractor names, phone numbers or access arrangements
  * costs, values, or anything financial
  * notes, descriptions or free text the user typed
  * utility or shut-off locations
  * anything implying the house is empty

If the email is forwarded or the inbox is breached, the blast radius must be
"this person has a home and owns a furnace".$c$;

revoke execute on function public.build_user_digest(uuid, integer) from public, anon, authenticated;
grant execute on function public.build_user_digest(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Who is due a send right now. The cron runs daily; this decides who that
-- actually means, so frequency is a per-user preference rather than a
-- property of the schedule.
-- ---------------------------------------------------------------------------
create or replace function public.users_due_for_digest(send_hour integer default 8)
returns table (
  user_id uuid,
  email text,
  frequency text,
  time_zone text,
  period_key text,
  payload jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.user_id,
    u.email,
    p.frequency,
    p.time_zone,
    case p.frequency
      when 'weekly' then to_char(timezone(p.time_zone, now()), 'IYYY-"W"IW')
      else to_char(timezone(p.time_zone, now()), 'YYYY-MM')
    end as period_key,
    public.build_user_digest(p.user_id, case p.frequency when 'weekly' then 10 else 35 end) as payload
  from public.digest_preferences p
  join auth.users u on u.id = p.user_id
  where p.frequency <> 'off'
    and u.email is not null
    -- Only at a civilised local hour.
    and extract(hour from timezone(p.time_zone, now())) = send_hour
    -- Weekly on Monday; monthly on the 1st.
    and (
      (p.frequency = 'weekly' and extract(isodow from timezone(p.time_zone, now())) = 1)
      or
      (p.frequency = 'monthly' and extract(day from timezone(p.time_zone, now())) = 1)
    )
    -- Never twice in the same period.
    and not exists (
      select 1 from public.digest_log l
      where l.user_id = p.user_id
        and l.kind = 'digest'
        and l.period_key = case p.frequency
          when 'weekly' then to_char(timezone(p.time_zone, now()), 'IYYY-"W"IW')
          else to_char(timezone(p.time_zone, now()), 'YYYY-MM')
        end
    );
$$;

revoke execute on function public.users_due_for_digest(integer) from public, anon, authenticated;
grant execute on function public.users_due_for_digest(integer) to service_role;

comment on function public.users_due_for_digest(integer) is
  'Users whose local time is the configured send hour on their chosen day, who have not already been sent this period. Callers must still skip anyone whose payload item_count is 0 — never send an empty digest.';

notify pgrst, 'reload schema';
