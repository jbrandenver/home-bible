-- 047: the fee ladder becomes real.
--
--   home 1        free, forever
--   homes 2 and 3 $4.99/mo each (one additional_home subscription per home)
--   home 4+       the Portfolio plan
--
-- Two changes, and the second is the one that is easy to miss.
--
-- 1. free_property_allowance() 2 -> 1. /pricing has said "first home free"
--    since the 2026-07-31 ruling while the database allowed two. The gap was
--    deliberate — it existed so nobody was blocked from a second home before
--    there was anything to buy — and it is closed now that the $4.99 product,
--    its Payment Link (product_key metadata verified against the working
--    Portfolio link), the webhook mapping and the entitlement arithmetic all
--    exist.
--
-- 2. The additional_home contribution is CAPPED at two.
--
--    property_allowance_for() previously added one home per active
--    additional_home subscription with no ceiling, which quietly undercut the
--    plan it is meant to lead into: five subscriptions is $24.95/mo for six
--    homes against $29/mo for unlimited, so the rational move was to stack
--    $4.99s and never buy Portfolio at all. With the cap, three homes is the
--    most reachable without a plan, which is what the page has always said.
--
-- Nobody loses a home. 035's check is INSERT-only and never re-tests existing
-- rows, so accounts already over the line keep everything they have; the ladder
-- only governs the NEXT home. At the time of writing that is four accounts with
-- one home each and one with four (the founder), so no live account is affected.

create or replace function public.free_property_allowance()
returns integer
language sql
immutable
set search_path = ''
as $$
  -- Mirrors FREE_PROPERTY_ALLOWANCE in apps/web/lib/entitlements.ts. This one
  -- decides what the database permits; the client value only decides what the
  -- UI offers. Keep them in step, and ship the client side first — a UI
  -- offering the paid step while the database is still lenient costs nothing,
  -- whereas the reverse blocks a customer with an explanation the page has not
  -- caught up to.
  select 1;
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
    else public.free_property_allowance() + least(
      -- Capped at two: homes two and three. Without this, stacked $4.99
      -- subscriptions undercut the Portfolio plan and the fourth home never
      -- requires it.
      (
        select count(*)::int
        from public.entitlements e
        where e.user_id = p_user_id
          and e.product_key = 'additional_home'
          and e.status = 'active'
          and (e.expires_at is null or e.expires_at > now())
      ),
      2
    )
  end;
$$;
