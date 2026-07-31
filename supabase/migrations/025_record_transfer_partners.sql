-- Record transfer, partner registry, and plate-scan quota log.
--
-- THE TRANSFER PRIMITIVE (decision D-22). One mechanism serves three
-- journeys: a seller hands the buyer the living record at closing, an
-- inspector provisions a pre-seeded record and gifts it to the buyer, and an
-- estate passes the house to an heir. Shape mirrors the invitation system
-- (015): a 32-byte code returned exactly once, SHA-256 at rest, expiring,
-- revocable, single-use, optionally email-pinned — but where an invitation
-- grants a seat, a claim MOVES OWNERSHIP:
--   * properties.owner_user_id and household_id flip to the claimant
--     (building first, then its units, so the nesting guard stays satisfied);
--   * the claimant gets the owner member row;
--   * every other seat is cleared and outstanding invitations revoked —
--     a sale must not quietly keep the seller's plumber on the record;
--   * the issuer keeps at most an explicitly chosen viewer/editor seat.
--
-- The owner-immutability guard from 015 exists precisely to forbid what a
-- claim does, so it gains a narrow escape hatch: a transaction-local config
-- flag set only inside claim_property_transfer, wrapped around only the
-- ownership updates. Same pattern 015 already uses for invitation acceptance.
--
-- PARTNERS: self-registered professional identities (inspector, agent,
-- property manager) used to co-brand a transfer ("Prepared for you by …").
-- Registration grants nothing — a partner row is a label, not a role.
--
-- PLATE_SCANS: an append-only (service-role) usage log for the AI data-plate
-- scanner, so the free-tier cap is enforced server-side where the API key
-- lives, not in the client.

-- 1. Plate-scan usage log ----------------------------------------------------

create table if not exists public.plate_scans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  property_id  uuid references public.properties(id) on delete set null,
  asset_id     uuid references public.assets(id) on delete set null,
  status       text not null default 'ok' check (status in ('ok','failed')),
  created_at   timestamptz not null default now()
);

create index if not exists plate_scans_user_idx on public.plate_scans (user_id, created_at desc);

alter table public.plate_scans enable row level security;

drop policy if exists p12_plate_scans_select_own on public.plate_scans;
create policy p12_plate_scans_select_own on public.plate_scans
for select using ((select auth.uid()) = user_id);

-- Only the Edge Function (service role) writes scan rows: a user-writable
-- usage log is a self-refilling quota.
revoke insert, update, delete on public.plate_scans from anon, authenticated;

-- 2. Partners ---------------------------------------------------------------

create table if not exists public.partners (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users(id) on delete cascade,
  business_name  text not null check (char_length(business_name) between 1 and 200),
  partner_kind   text not null default 'other'
                   check (partner_kind in ('inspector','agent','property_manager','other')),
  website        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

alter table public.partners enable row level security;

drop policy if exists p12_partners_select_own on public.partners;
create policy p12_partners_select_own on public.partners
for select using ((select auth.uid()) = user_id and deleted_at is null);

drop policy if exists p12_partners_insert_own on public.partners;
create policy p12_partners_insert_own on public.partners
for insert with check ((select auth.uid()) = user_id);

drop policy if exists p12_partners_update_own on public.partners;
create policy p12_partners_update_own on public.partners
for update using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop trigger if exists partners_set_updated_at on public.partners;
create trigger partners_set_updated_at
before update on public.partners
for each row execute function public.set_updated_at();

-- 3. Property transfers ------------------------------------------------------

create table if not exists public.property_transfers (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid not null references public.properties(id) on delete cascade,
  issuer_user_id   uuid not null references auth.users(id) on delete cascade,
  partner_id       uuid references public.partners(id) on delete set null,
  recipient_email  text,
  code_hash        text not null unique,
  keep_issuer_role text check (keep_issuer_role is null or keep_issuer_role in ('editor','viewer')),
  expires_at       timestamptz not null,
  claimed_at       timestamptz,
  claimed_by       uuid references auth.users(id) on delete set null,
  revoked_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index if not exists property_transfers_property_idx
  on public.property_transfers (property_id)
  where deleted_at is null;

alter table public.property_transfers enable row level security;

-- Issuer and (after claiming) claimant may read. All writes go through the
-- RPCs below — there is deliberately no insert/update/delete policy, plus an
-- explicit revoke, for the same reason as entitlements (022): a permissive
-- policy here would let someone mint or redirect an ownership handoff.
drop policy if exists p12_property_transfers_select on public.property_transfers;
create policy p12_property_transfers_select on public.property_transfers
for select using (
  ((select auth.uid()) = issuer_user_id or (select auth.uid()) = claimed_by)
  and deleted_at is null
);

revoke insert, update, delete on public.property_transfers from anon, authenticated;

drop trigger if exists property_transfers_set_updated_at on public.property_transfers;
create trigger property_transfers_set_updated_at
before update on public.property_transfers
for each row execute function public.set_updated_at();

-- An issued transfer is append-only, like an invitation (015): its identity
-- cannot be rewritten and a claimed transfer cannot be reopened.
create or replace function public.guard_property_transfer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.property_id is distinct from new.property_id
    or old.issuer_user_id is distinct from new.issuer_user_id
    or old.partner_id is distinct from new.partner_id
    or old.recipient_email is distinct from new.recipient_email
    or old.code_hash is distinct from new.code_hash
    or old.keep_issuer_role is distinct from new.keep_issuer_role
    or old.expires_at is distinct from new.expires_at then
    raise exception 'an issued transfer cannot be rewritten';
  end if;

  if old.claimed_at is not null and new.claimed_at is distinct from old.claimed_at then
    raise exception 'a claimed transfer cannot be reopened';
  end if;

  return new;
end;
$$;

drop trigger if exists property_transfers_guard on public.property_transfers;
create trigger property_transfers_guard
before update on public.property_transfers
for each row execute function public.guard_property_transfer();

-- 4. The owner-immutability escape hatch ------------------------------------
-- Identical body to 015 plus the transaction-local transfer window. The flag
-- is set with set_config(..., true) — transaction-scoped — inside
-- claim_property_transfer only, wrapped around only the ownership updates.

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
    raise exception 'owner_user_id cannot be changed';
  end if;
  return new;
end;
$$;

-- 5. RPCs --------------------------------------------------------------------

-- Issue a transfer code for a property you own. Only the owner — not a
-- co-owner — may give the property away, and only a top-level property:
-- units move with their building, never alone.
create or replace function public.create_property_transfer(
  target_property_id uuid,
  target_recipient_email text default null,
  target_keep_role text default null,
  target_expires_in_seconds integer default 1209600
)
returns table (transfer_id uuid, transfer_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.properties%rowtype;
  raw_code text;
  clamped_expiry timestamptz;
  cleaned_email text;
  issuer_partner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into prop
  from public.properties
  where id = target_property_id and deleted_at is null;

  if not found then
    raise exception 'property not found';
  end if;

  if prop.owner_user_id <> auth.uid() then
    raise exception 'only the owner can transfer a property';
  end if;

  if prop.parent_property_id is not null then
    raise exception 'units transfer with their building, not on their own';
  end if;

  if target_keep_role is not null and target_keep_role not in ('editor','viewer') then
    raise exception 'keep role must be editor or viewer';
  end if;

  cleaned_email := nullif(lower(trim(coalesce(target_recipient_email, ''))), '');

  clamped_expiry := now() + make_interval(secs => least(greatest(coalesce(target_expires_in_seconds, 1209600), 300), 7776000));

  raw_code := encode(extensions.gen_random_bytes(32), 'hex');

  select id into issuer_partner_id
  from public.partners
  where user_id = auth.uid() and deleted_at is null;

  insert into public.property_transfers
    (property_id, issuer_user_id, partner_id, recipient_email, code_hash, keep_issuer_role, expires_at)
  values
    (target_property_id, auth.uid(), issuer_partner_id, cleaned_email,
     encode(extensions.digest(raw_code, 'sha256'), 'hex'), target_keep_role, clamped_expiry)
  returning id, clamped_expiry into transfer_id, expires_at;

  transfer_code := raw_code;
  return next;
end;
$$;

-- What a claimant sees before accepting: the property nickname, who prepared
-- it, and the clock. Read-only; keyed by the code itself, so it works for a
-- signed-in user who holds no seat yet.
create or replace function public.get_property_transfer_preview(transfer_code text)
returns table (
  property_nickname text,
  issuer_business_name text,
  issuer_partner_kind text,
  recipient_email text,
  expires_at timestamptz,
  already_claimed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  xfer public.property_transfers%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into xfer
  from public.property_transfers
  where code_hash = encode(extensions.digest(coalesce(transfer_code, ''), 'sha256'), 'hex')
    and deleted_at is null;

  if not found or xfer.revoked_at is not null or xfer.expires_at < now() then
    raise exception 'this transfer code is not valid';
  end if;

  return query
  select p.nickname,
         pa.business_name,
         pa.partner_kind,
         xfer.recipient_email,
         xfer.expires_at,
         (xfer.claimed_at is not null)
  from public.properties p
  left join public.partners pa on pa.id = xfer.partner_id and pa.deleted_at is null
  where p.id = xfer.property_id;
end;
$$;

-- The claim itself. Moves the building and every unit under it into the
-- claimant's household and ownership, seats the claimant as owner, clears
-- every other seat, revokes outstanding invitations, and retains the issuer
-- only in the explicitly chosen role.
-- Dropped first because an earlier revision shipped a different OUT signature,
-- and create-or-replace cannot change a function's return type.
drop function if exists public.claim_property_transfer(text);

-- OUT column names deliberately avoid table column names (claimed_ prefix):
-- a bare `property_id` OUT parameter is ambiguous inside the function body's
-- ON CONFLICT clause and fails at runtime.
create or replace function public.claim_property_transfer(transfer_code text)
returns table (claimed_property_id uuid, claimed_property_nickname text)
language plpgsql
security definer
set search_path = public
as $$
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

  -- The issuer must still own what they are handing over — a transfer minted
  -- before the issuer themselves lost ownership must die with that loss.
  if prop.owner_user_id <> xfer.issuer_user_id then
    raise exception 'this transfer is no longer valid';
  end if;

  -- Find or create the claimant's household (one active household per user).
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

  -- Ownership moves: building first, then its units, so the nesting guard
  -- (unit household/owner must match the parent) is satisfied row by row.
  perform set_config('app.claiming_property_transfer', 'on', true);

  update public.properties
  set owner_user_id = claimant, household_id = claimant_household
  where id = prop.id;

  update public.properties
  set owner_user_id = claimant, household_id = claimant_household
  where parent_property_id = prop.id and deleted_at is null;

  perform set_config('app.claiming_property_transfer', '', true);

  -- Seats, for the building and every unit: claimant becomes owner; everyone
  -- else — including the issuer — is cleared; the issuer is re-seated only in
  -- the explicitly chosen role. A sale must not quietly keep the seller's
  -- plumber, buyer-preview, or ex-partner on the record.
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

  return query
  select prop.id, prop.nickname;
end;
$$;

-- Revoke an unclaimed transfer you issued.
create or replace function public.revoke_property_transfer(target_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  xfer public.property_transfers%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into xfer
  from public.property_transfers
  where id = target_transfer_id and deleted_at is null
  for update;

  if not found or xfer.issuer_user_id <> auth.uid() then
    raise exception 'transfer not found';
  end if;
  if xfer.claimed_at is not null then
    raise exception 'this transfer has already been claimed';
  end if;
  if xfer.revoked_at is not null then
    return;
  end if;

  update public.property_transfers
  set revoked_at = now()
  where id = xfer.id;
end;
$$;

-- 6. Grants (018/019 discipline) --------------------------------------------

revoke execute on function public.guard_property_transfer() from public, anon, authenticated;
revoke execute on function public.guard_property_owner_user_id() from public, anon, authenticated;

revoke execute on function public.create_property_transfer(uuid, text, text, integer) from public, anon;
grant execute on function public.create_property_transfer(uuid, text, text, integer) to authenticated, service_role;

revoke execute on function public.get_property_transfer_preview(text) from public, anon;
grant execute on function public.get_property_transfer_preview(text) to authenticated, service_role;

revoke execute on function public.claim_property_transfer(text) from public, anon;
grant execute on function public.claim_property_transfer(text) to authenticated, service_role;

revoke execute on function public.revoke_property_transfer(uuid) from public, anon;
grant execute on function public.revoke_property_transfer(uuid) to authenticated, service_role;

-- 7. Text bounds for the new tables (013 naming convention) ------------------

do $$
declare
  col record;
  cons_name text;
begin
  for col in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.table_name in ('plate_scans','partners','property_transfers')
      and c.data_type in ('text', 'character varying')
  loop
    cons_name := left(col.table_name || '_' || col.column_name || '_maxlen', 63);
    if not exists (
      select 1 from pg_constraint where conname = cons_name
    ) then
      execute format(
        'alter table public.%I add constraint %I check (char_length(%I) <= 50000) not valid',
        col.table_name, cons_name, col.column_name
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
