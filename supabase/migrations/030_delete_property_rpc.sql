-- 030: owner-scoped property deletion (and archive purge) via RPC.
--
-- Launch QA 2026-08-03: soft-deleting a property from the client failed with
-- "new row violates row-level security policy". The update policy's WITH
-- CHECK re-evaluates is_property_editor() against the NEW row — and once
-- deleted_at is set, current_property_role() no longer counts the caller as
-- owner, so the soft-delete rejects itself. (Archiving worked only because
-- the role function never looks at archived_at.)
--
-- Fix: SECURITY DEFINER functions that verify ownership themselves, the same
-- pattern as accept_property_invitation. Ownership means owner_user_id =
-- auth.uid() on a live row; a building takes its units with it.

create or replace function public.delete_property_as_owner(p_property_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
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

  return affected;
end;
$$;

-- Archives past their retention window become deletions; called
-- opportunistically when the portfolio loads. Same WITH CHECK trap as above,
-- so it lives here too. Retention is bounded to keep the parameter honest.
create or replace function public.purge_expired_archived_properties(p_retention_days integer default 90)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    return 0;
  end if;

  if p_retention_days < 30 then
    raise exception 'Retention window is at least 30 days.';
  end if;

  update public.properties
     set deleted_at = now()
   where owner_user_id = auth.uid()
     and deleted_at is null
     and archived_at is not null
     and archived_at < now() - make_interval(days => p_retention_days);
  get diagnostics affected = row_count;

  return affected;
end;
$$;

-- Execute grants follow migrations 018/019: nothing runs these but signed-in
-- users.
revoke all on function public.delete_property_as_owner(uuid) from public, anon;
grant execute on function public.delete_property_as_owner(uuid) to authenticated;
revoke all on function public.purge_expired_archived_properties(integer) from public, anon;
grant execute on function public.purge_expired_archived_properties(integer) to authenticated;
