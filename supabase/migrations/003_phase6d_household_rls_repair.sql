-- Phase 6D repair migration
-- Ensures signed-in property creation can create its household/member rows through RLS.
-- This is idempotent and safe to run against projects that already have Phase 6A policies.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.households
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table public.households
  alter column id set default gen_random_uuid(),
  alter column created_at set default now(),
  alter column updated_at set default now();

drop trigger if exists households_set_updated_at on public.households;
create trigger households_set_updated_at
before update on public.households
for each row execute function public.set_updated_at();

alter table public.household_members
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table public.household_members
  alter column id set default gen_random_uuid(),
  alter column created_at set default now(),
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'household_members_household_id_user_id_key'
      and conrelid = 'public.household_members'::regclass
  ) then
    alter table public.household_members
      add constraint household_members_household_id_user_id_key unique (household_id, user_id);
  end if;
end $$;

drop trigger if exists household_members_set_updated_at on public.household_members;
create trigger household_members_set_updated_at
before update on public.household_members
for each row execute function public.set_updated_at();

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.households h
    where h.id = target_household_id
      and h.deleted_at is null
      and h.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.deleted_at is null
      and hm.user_id = auth.uid()
      and hm.role in ('owner','co_owner','editor','viewer')
  );
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;

drop policy if exists p6a_households_select_member on public.households;
drop policy if exists p6d_households_select_member on public.households;
create policy p6d_households_select_member on public.households
for select using (public.is_household_member(id) and deleted_at is null);

drop policy if exists p6a_households_insert_owner on public.households;
drop policy if exists p6d_households_insert_owner on public.households;
create policy p6d_households_insert_owner on public.households
for insert with check (owner_user_id = auth.uid());

drop policy if exists p6a_households_update_editor on public.households;
drop policy if exists p6d_households_update_editor on public.households;
create policy p6d_households_update_editor on public.households
for update using (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.household_members hm
    where hm.household_id = households.id
      and hm.deleted_at is null
      and hm.user_id = auth.uid()
      and hm.role in ('owner','co_owner','editor')
  )
) with check (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.household_members hm
    where hm.household_id = households.id
      and hm.deleted_at is null
      and hm.user_id = auth.uid()
      and hm.role in ('owner','co_owner','editor')
  )
);

drop policy if exists p6a_households_delete_owner on public.households;
drop policy if exists p6d_households_delete_owner on public.households;
create policy p6d_households_delete_owner on public.households
for delete using (owner_user_id = auth.uid());

drop policy if exists household_members_insert_self on public.household_members;
drop policy if exists household_members_select_by_member on public.household_members;
drop policy if exists p6a_household_members_select_member on public.household_members;
drop policy if exists p6d_household_members_select_member on public.household_members;
create policy p6d_household_members_select_member on public.household_members
for select using (public.is_household_member(household_id) and deleted_at is null);

drop policy if exists p6a_household_members_insert_editor on public.household_members;
drop policy if exists p6d_household_members_insert_editor on public.household_members;
create policy p6d_household_members_insert_editor on public.household_members
for insert with check (
  exists (
    select 1
    from public.households h
    where h.id = household_id
      and h.deleted_at is null
      and h.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.household_members hm
    where hm.household_id = household_members.household_id
      and hm.deleted_at is null
      and hm.user_id = auth.uid()
      and hm.role in ('owner','co_owner','editor')
  )
);

drop policy if exists p6a_household_members_update_editor on public.household_members;
drop policy if exists p6d_household_members_update_editor on public.household_members;
create policy p6d_household_members_update_editor on public.household_members
for update using (
  exists (
    select 1
    from public.households h
    where h.id = household_id
      and h.deleted_at is null
      and h.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.household_members hm
    where hm.household_id = household_members.household_id
      and hm.deleted_at is null
      and hm.user_id = auth.uid()
      and hm.role in ('owner','co_owner','editor')
  )
) with check (
  exists (
    select 1
    from public.households h
    where h.id = household_id
      and h.deleted_at is null
      and h.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.household_members hm
    where hm.household_id = household_members.household_id
      and hm.deleted_at is null
      and hm.user_id = auth.uid()
      and hm.role in ('owner','co_owner','editor')
  )
);

drop policy if exists p6a_household_members_delete_editor on public.household_members;
drop policy if exists p6d_household_members_delete_editor on public.household_members;
create policy p6d_household_members_delete_editor on public.household_members
for delete using (
  exists (
    select 1
    from public.households h
    where h.id = household_id
      and h.deleted_at is null
      and h.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.household_members hm
    where hm.household_id = household_members.household_id
      and hm.deleted_at is null
      and hm.user_id = auth.uid()
      and hm.role in ('owner','co_owner','editor')
  )
);
