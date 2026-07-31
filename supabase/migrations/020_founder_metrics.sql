-- Founder metrics, computed from the records that already exist.
--
-- The app had no analytics at all, so there was no baseline for anything. The
-- reflex is to add a tracking tool, but three of the four questions worth
-- asking — do people sign up, do they create a property, do they record their
-- first utility — are already rows with timestamps in this database. Answering
-- them in SQL is free, needs no third-party script on a page showing someone's
-- private home record, needs no cookie banner, and works RETROACTIVELY over
-- every user since launch rather than only from the day a tracker was added.
--
-- An event log is still worth building later, but only for the things that
-- leave no row behind: drop-off inside a form, dead-end errors, and traffic
-- before signup. That is a much smaller system than a general analytics tool.
--
-- SECURITY: these views aggregate across ALL users, so they must never be
-- reachable from the browser. They live in a private `metrics` schema which is
-- deliberately NOT added to Supabase's exposed schemas, and EXECUTE/SELECT is
-- granted only to service_role. `security_invoker` keeps the caller's own
-- permissions in force rather than the definer's.

create schema if not exists metrics;

revoke all on schema metrics from public, anon, authenticated;
grant usage on schema metrics to service_role;

-- ---------------------------------------------------------------------------
-- Per-user milestones. One row per signed-up account.
-- ---------------------------------------------------------------------------
create or replace view metrics.user_milestones
with (security_invoker = true)
as
select
  u.id                                     as user_id,
  u.created_at                             as signed_up_at,
  p.first_property_at,
  r.first_room_at,
  ut.first_utility_at,
  ut.first_water_shutoff_at,
  ut.first_electrical_panel_at,
  a.first_asset_at,
  d.first_document_at,
  rp.first_repair_at,
  rm.first_reminder_at,
  greatest(
    coalesce(r.last_write_at,  'epoch'::timestamptz),
    coalesce(ut.last_write_at, 'epoch'::timestamptz),
    coalesce(a.last_write_at,  'epoch'::timestamptz),
    coalesce(rp.last_write_at, 'epoch'::timestamptz),
    coalesce(rm.last_write_at, 'epoch'::timestamptz)
  )                                        as last_write_at,
  -- Distinct kinds of record present. Two or more is the behavioural signature
  -- of "this is where home stuff goes" rather than "I tried it once".
  (case when r.first_room_at      is not null then 1 else 0 end)
  + (case when ut.first_utility_at  is not null then 1 else 0 end)
  + (case when a.first_asset_at     is not null then 1 else 0 end)
  + (case when rp.first_repair_at   is not null then 1 else 0 end)
  + (case when rm.first_reminder_at is not null then 1 else 0 end)
  + (case when d.first_document_at  is not null then 1 else 0 end) as record_kinds
from auth.users u
left join lateral (
  select min(created_at) as first_property_at
  from public.properties
  where owner_user_id = u.id and deleted_at is null
) p on true
left join lateral (
  select min(rooms.created_at) as first_room_at, max(rooms.created_at) as last_write_at
  from public.rooms
  join public.properties prop on prop.id = rooms.property_id
  where prop.owner_user_id = u.id and rooms.deleted_at is null
) r on true
left join lateral (
  select
    min(utilities.created_at) as first_utility_at,
    max(utilities.created_at) as last_write_at,
    min(utilities.created_at) filter (where utilities.utility_type = 'main_water_shutoff') as first_water_shutoff_at,
    min(utilities.created_at) filter (where utilities.utility_type = 'electrical_panel')   as first_electrical_panel_at
  from public.utilities
  join public.properties prop on prop.id = utilities.property_id
  where prop.owner_user_id = u.id and utilities.deleted_at is null
) ut on true
left join lateral (
  select min(assets.created_at) as first_asset_at, max(assets.created_at) as last_write_at
  from public.assets
  join public.properties prop on prop.id = assets.property_id
  where prop.owner_user_id = u.id and assets.deleted_at is null
) a on true
left join lateral (
  select min(documents.created_at) as first_document_at
  from public.documents
  join public.properties prop on prop.id = documents.property_id
  where prop.owner_user_id = u.id and documents.deleted_at is null
) d on true
left join lateral (
  select min(repairs.created_at) as first_repair_at, max(repairs.created_at) as last_write_at
  from public.repairs
  join public.properties prop on prop.id = repairs.property_id
  where prop.owner_user_id = u.id and repairs.deleted_at is null
) rp on true
left join lateral (
  select min(reminders.created_at) as first_reminder_at, max(reminders.created_at) as last_write_at
  from public.reminders
  join public.properties prop on prop.id = reminders.property_id
  where prop.owner_user_id = u.id and reminders.deleted_at is null
) rm on true;

comment on view metrics.user_milestones is
  'One row per account with the first time they reached each milestone. Basis for the funnel and activation views.';

-- ---------------------------------------------------------------------------
-- Activation.
--
-- Deliberately NOT "created a property" — a property with nothing in it is a
-- completed signup, not an activated user. Activation is: the record became
-- worth returning to, quickly enough that we can still iterate on it.
--   property created + records of 2+ different kinds, within 7 days of signup.
-- Seven days rather than thirty so an onboarding change can be read the
-- following week instead of the following quarter.
-- ---------------------------------------------------------------------------
create or replace view metrics.activation
with (security_invoker = true)
as
select
  user_id,
  signed_up_at,
  first_property_at is not null as created_property,
  record_kinds,
  -- The two shut-offs the onboarding asks for, because that is the specific
  -- thing we are trying to move.
  first_water_shutoff_at is not null   as recorded_water_shutoff,
  first_electrical_panel_at is not null as recorded_electrical_panel,
  (
    first_property_at is not null
    and record_kinds >= 2
    and first_property_at <= signed_up_at + interval '7 days'
  ) as activated_7d,
  last_write_at > 'epoch'::timestamptz as has_ever_written,
  last_write_at
from metrics.user_milestones;

comment on view metrics.activation is
  'Activation = property + 2 or more kinds of record within 7 days. A property alone is a shell.';

-- ---------------------------------------------------------------------------
-- Weekly signup cohorts — the funnel, retroactive to launch.
-- ---------------------------------------------------------------------------
create or replace view metrics.signup_funnel
with (security_invoker = true)
as
select
  date_trunc('week', m.signed_up_at)::date              as signup_week,
  count(*)                                             as signups,
  count(*) filter (where m.first_property_at is not null)         as created_property,
  count(*) filter (where m.first_room_at is not null)             as added_room,
  count(*) filter (where m.first_utility_at is not null)          as added_utility,
  count(*) filter (where m.first_water_shutoff_at is not null)    as recorded_water_shutoff,
  count(*) filter (where m.first_electrical_panel_at is not null) as recorded_electrical_panel,
  count(*) filter (where m.first_asset_at is not null)            as added_asset,
  count(*) filter (where a.activated_7d)                          as activated_7d,
  round(
    100.0 * count(*) filter (where a.activated_7d) / nullif(count(*), 0),
    1
  )                                                    as activation_rate_pct
from metrics.user_milestones m
join metrics.activation a using (user_id)
group by 1
order by 1 desc;

comment on view metrics.signup_funnel is
  'Weekly cohorts from signup through to activation. Works over all history, not just since instrumentation.';

-- ---------------------------------------------------------------------------
-- Retention that means something for a low-frequency product: not a visit, a
-- WRITE. Someone opening the app from a bookmark tells us nothing; someone
-- recording a repair means a real home event happened and they chose to put it
-- here.
-- ---------------------------------------------------------------------------
create or replace view metrics.write_retention
with (security_invoker = true)
as
select
  date_trunc('week', signed_up_at)::date as signup_week,
  count(*)                               as signups,
  count(*) filter (
    where last_write_at >= signed_up_at + interval '7 days'
  )                                      as wrote_after_week_1,
  count(*) filter (
    where last_write_at >= signed_up_at + interval '28 days'
  )                                      as wrote_after_week_4
from metrics.user_milestones
group by 1
order by 1 desc;

comment on view metrics.write_retention is
  'Returned AND wrote something. For a low-frequency record app, passive visits are noise.';

grant select on all tables in schema metrics to service_role;
alter default privileges in schema metrics grant select on tables to service_role;

notify pgrst, 'reload schema';
