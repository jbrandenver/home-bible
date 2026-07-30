-- Purchases and entitlements.
--
-- Nothing here needs a Stripe account to exist. The tables and the permission
-- helper can be created, reviewed and tested now; when the account arrives, the
-- only new moving part is a webhook function that writes rows with the service
-- role.
--
-- THE ENTIRE SECURITY MODEL IS WHAT IS ABSENT.
-- `entitlements` has a SELECT policy and no INSERT, UPDATE or DELETE policy at
-- all. RLS denies by default when no permissive policy matches, so a signed-in
-- user can read their own purchases and can do nothing else. The webhook writes
-- with the service role, which bypasses RLS, and its key never leaves the Edge
-- Function environment.
--
-- The tempting mistake is a policy like:
--     for insert with check (auth.uid() = user_id)
-- which reads as "you may only insert rows for yourself" and is in fact a
-- free-money button: anyone can open devtools and grant themselves everything.
-- There must be no insert policy on this table under any circumstances.

create table if not exists public.entitlements (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users(id) on delete cascade,
  product_key                 text not null,
  property_id                 uuid references public.properties(id) on delete set null,
  status                      text not null default 'active'
                                check (status in ('active', 'refunded', 'revoked')),
  granted_at                  timestamptz not null default now(),
  expires_at                  timestamptz,
  revoked_at                  timestamptz,
  -- Provenance, for audit, reconciliation and idempotency.
  provider                    text not null default 'stripe',
  provider_checkout_id        text unique,
  provider_payment_intent_id  text,
  amount_total_cents          integer,
  currency                    text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint entitlements_product_key_len check (char_length(product_key) <= 64)
);

create index if not exists entitlements_active_idx
  on public.entitlements (user_id, product_key)
  where status = 'active';

alter table public.entitlements enable row level security;

drop policy if exists entitlements_select_own on public.entitlements;
create policy entitlements_select_own on public.entitlements
for select using ((select auth.uid()) = user_id);

-- Deliberately no insert / update / delete policy. See the header.
-- Explicit grant revocation as well, so a future well-meaning
-- `for all using (true)` added during debugging cannot quietly open it.
revoke insert, update, delete on public.entitlements from anon, authenticated;

drop trigger if exists entitlements_set_updated_at on public.entitlements;
create trigger entitlements_set_updated_at
before update on public.entitlements
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Payment-provider event log. Idempotency lives in the database, not in
-- application logic: two concurrent webhook retries would both pass a
-- SELECT-then-INSERT check, so the unique constraint arbitrates instead.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_events (
  id           text primary key,
  provider     text not null default 'stripe',
  type         text not null,
  object_id    text,
  payload      jsonb not null,
  received_at  timestamptz not null default now()
);

-- Stripe occasionally emits two distinct events for one underlying object.
create unique index if not exists payment_events_object_type_uidx
  on public.payment_events (object_id, type)
  where object_id is not null;

alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Download audit. Unglamorous, and the only evidence that wins a chargeback:
-- Stripe's dispute guidance for digital goods asks for logs proving access
-- after payment. Costs nothing now, impossible to reconstruct later.
-- ---------------------------------------------------------------------------
create table if not exists public.entitlement_downloads (
  id              uuid primary key default gen_random_uuid(),
  entitlement_id  uuid not null references public.entitlements(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  product_key     text not null,
  downloaded_at   timestamptz not null default now()
);

alter table public.entitlement_downloads enable row level security;

-- A user may record their own download (it is evidence in their favour too),
-- but only against an entitlement they actually hold.
drop policy if exists entitlement_downloads_insert_own on public.entitlement_downloads;
create policy entitlement_downloads_insert_own on public.entitlement_downloads
for insert with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.entitlements e
    where e.id = entitlement_id
      and e.user_id = (select auth.uid())
      and e.status = 'active'
  )
);

drop policy if exists entitlement_downloads_select_own on public.entitlement_downloads;
create policy entitlement_downloads_select_own on public.entitlement_downloads
for select using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- The permission helper other policies compose with.
--
-- `set search_path = ''` is mandatory, not stylistic: a SECURITY DEFINER
-- function without it can be hijacked by a caller who prepends a schema and
-- shadows the table. Every reference below is fully qualified for the same
-- reason.
--
-- It takes NO user id — identity comes from auth.uid() internally. A helper
-- that accepted p_user_id would be the self-grant hole in a different shape.
-- ---------------------------------------------------------------------------
create or replace function public.has_entitlement(
  p_product_key text,
  p_property_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.user_id = (select auth.uid())
      and e.product_key = p_product_key
      and e.status = 'active'
      and (e.expires_at is null or e.expires_at > now())
      and (p_property_id is null or e.property_id is null or e.property_id = p_property_id)
  );
$$;

revoke execute on function public.has_entitlement(text, uuid) from public, anon;
grant execute on function public.has_entitlement(text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Purchases that arrived without a resolvable buyer. A Payment Link carries
-- the user id as a URL parameter, which a buyer can strip or mistype — Stripe
-- silently drops an invalid value rather than erroring. That yields money taken
-- and nobody to grant. Rare, but it must land somewhere visible instead of
-- being lost.
-- ---------------------------------------------------------------------------
create table if not exists public.unmatched_purchases (
  id                    uuid primary key default gen_random_uuid(),
  provider              text not null default 'stripe',
  provider_checkout_id  text unique not null,
  customer_email        text,
  product_key           text,
  amount_total_cents    integer,
  currency              text,
  raw_reference         text,
  resolved_at           timestamptz,
  created_at            timestamptz not null default now()
);

alter table public.unmatched_purchases enable row level security;
revoke all on public.unmatched_purchases from anon, authenticated;

notify pgrst, 'reload schema';
