-- Account erasure, done atomically (audit 2026-07-29, finding EA-1).
--
-- The delete-account edge function previously issued six independent writes and
-- discarded every { error }, then deleted the auth user regardless. A transient
-- failure on the profile anonymisation left the user's email and name in place
-- while the caller was told deletion succeeded — a silent erasure failure the
-- user can no longer detect or retry, because their account is gone.
--
-- Moving the data steps into one SECURITY DEFINER function makes them a single
-- transaction: either every trace is cleared or nothing is, and the edge
-- function deletes the auth user only after this returns successfully.

create or replace function public.delete_account_data(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  property record;
  successor_id uuid;
  transferred int := 0;
  closed int := 0;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  -- Hand each owned property to the longest-standing remaining owner/co-owner,
  -- or soft-delete it when nobody is left to inherit it.
  for property in
    select id from public.properties
    where owner_user_id = target_user_id and deleted_at is null
  loop
    select pm.user_id into successor_id
    from public.property_members pm
    where pm.property_id = property.id
      and pm.role in ('owner', 'co_owner')
      and pm.deleted_at is null
      and pm.user_id <> target_user_id
    order by pm.created_at asc
    limit 1;

    if successor_id is not null then
      update public.properties
      set owner_user_id = successor_id
      where id = property.id;
      transferred := transferred + 1;
    else
      update public.properties
      set deleted_at = now()
      where id = property.id;
      closed := closed + 1;
    end if;

    successor_id := null;
  end loop;

  update public.property_members
  set deleted_at = now()
  where user_id = target_user_id and deleted_at is null;

  update public.household_members
  set deleted_at = now()
  where user_id = target_user_id and deleted_at is null;

  update public.profiles
  set email = null,
      full_name = 'Deleted account',
      avatar_url = null,
      deleted_at = now()
  where id = target_user_id;

  return jsonb_build_object(
    'properties_transferred', transferred,
    'properties_closed', closed
  );
end;
$$;

-- Service role only. This bypasses RLS by design, so no browser-reachable role
-- may call it; the edge function verifies the caller's JWT and passes the
-- id it derived from that token.
revoke execute on function public.delete_account_data(uuid) from public;
revoke execute on function public.delete_account_data(uuid) from anon;
revoke execute on function public.delete_account_data(uuid) from authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;

notify pgrst, 'reload schema';
