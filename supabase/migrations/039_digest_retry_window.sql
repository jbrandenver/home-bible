-- 039: let a failed digest be retried instead of silently swallowing it.
--
-- Three facts combined into a quiet data-loss bug:
--
-- 1. Every monthly subscriber fires on the 1st at 8am local and every weekly
--    one on Monday at 8am local, so a whole timezone lands in one burst with
--    no spreading.
-- 2. send-digest looped over them with no delay, which trips Resend's
--    per-second rate limit once more than a couple of people share an hour.
-- 3. A failed send wrote a digest_log row with status 'failed' — and the
--    not-exists guard below matched on period_key ALONE, without checking
--    status. A failure therefore looked exactly like a delivery.
--
-- Net effect: from the third subscriber in a timezone onward, people silently
-- stopped getting their digest for the whole period, and the only trace was a
-- row in a table nothing reads. It works perfectly at one subscriber, which is
-- why it has not bitten yet — there is exactly one today.
--
-- Two changes here (the throttle is in the function):
--
-- * Only a 'sent' or 'skipped' row suppresses. A 'failed' row makes the user
--   eligible again. The status check constraint allows exactly these three
--   values, so this is exhaustive.
--
-- * A retry window, because eligibility alone changes nothing: the guard also
--   requires the local hour to equal send_hour, and the cron fires once in
--   that hour, so a cleared user had no second attempt until the next period.
--   Monthly digests are now eligible on days 1-3 and weekly ones on Monday or
--   Tuesday, still only at 8am local. A success on day one writes a 'sent' row
--   that suppresses the remaining days, so nobody is mailed twice.
--
-- The founder ruling behind the wider window: the digest carries titles and
-- dates for things due over the next 35 days, so arriving on the 2nd instead
-- of the 1st costs the reader nothing, and silently missing a month does.
--
-- This also gives the batch limit in send-digest somewhere to spill: whoever
-- does not fit in one run has no digest_log row at all, so they are simply
-- still due tomorrow.

create or replace function public.users_due_for_digest(send_hour integer default 8)
returns table(user_id uuid, email text, frequency text, time_zone text, period_key text, payload jsonb)
language sql
stable
security definer
set search_path to ''
as $function$
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
    -- Weekly on Monday, monthly on the 1st — each with a retry window of the
    -- following day(s), so one bad send hour does not cost a whole period.
    and (
      (p.frequency = 'weekly'
        and extract(isodow from timezone(p.time_zone, now())) between 1 and 2)
      or
      (p.frequency = 'monthly'
        and extract(day from timezone(p.time_zone, now())) between 1 and 3)
    )
    -- Delivered or deliberately skipped this period? Done. A 'failed' row is
    -- NOT a delivery and must not suppress the retry.
    and not exists (
      select 1 from public.digest_log l
      where l.user_id = p.user_id
        and l.kind = 'digest'
        and l.status in ('sent', 'skipped')
        and l.period_key = case p.frequency
          when 'weekly' then to_char(timezone(p.time_zone, now()), 'IYYY-"W"IW')
          else to_char(timezone(p.time_zone, now()), 'YYYY-MM')
        end
    );
$function$;

revoke execute on function public.users_due_for_digest(integer) from public, anon, authenticated;
grant execute on function public.users_due_for_digest(integer) to service_role;

notify pgrst, 'reload schema';
