-- 040: let someone find an invitation that is waiting for them.
--
-- Accepting an invitation was possible only from the emailed link, because the
-- token lives nowhere else. Anything that interrupted the trip between opening
-- that link and clicking Accept — signing up, confirming an address, closing
-- the tab, signing in from somewhere else — stranded the recipient on the
-- dashboard with no route back except finding the original email again.
--
-- Found in founder QA: invited, signed up as the invited address, signed in,
-- and then no way to accept anything. The invitation was valid the whole time.
--
-- Two functions:
--
--   list_pending_invitations_for_me() — what is waiting for the address I am
--   signed in as. Deliberately never returns the token: the token is the
--   bearer credential from the email, and this list is a convenience, not a
--   second copy of it.
--
--   accept_pending_invitation(uuid) — accept one of those by id. It re-runs
--   every guard the token path enforces, and additionally REQUIRES the
--   invited_email to match the caller. That is what makes an id safe to hand
--   out where a token would not be: an open invitation (invited_email is null)
--   is deliberately invisible here and unacceptable this way, so nobody can
--   discover or claim one by guessing an id.

create or replace function public.list_pending_invitations_for_me()
returns table(
  invitation_id uuid,
  property_id uuid,
  property_nickname text,
  role text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    pi.id,
    pi.property_id,
    p.nickname,
    pi.role,
    pi.expires_at
  from public.property_invitations pi
  join public.properties p on p.id = pi.property_id
  join auth.users u on u.id = (select auth.uid())
  where pi.accepted_at is null
    and pi.revoked_at is null
    and pi.deleted_at is null
    and pi.expires_at > now()
    and p.deleted_at is null
    -- Addressed to me specifically. An open invitation has no invited_email
    -- and must stay invisible here; its token is the only way to accept it.
    and pi.invited_email is not null
    and pi.invited_email = lower(u.email)
  order by pi.created_at desc;
$function$;

revoke execute on function public.list_pending_invitations_for_me() from public, anon;
grant execute on function public.list_pending_invitations_for_me() to authenticated, service_role;

create or replace function public.accept_pending_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  invitation public.property_invitations%rowtype;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  select lower(email) into current_email from auth.users where id = auth.uid();

  select * into invitation
  from public.property_invitations pi
  where pi.id = p_invitation_id
    and pi.accepted_at is null
    and pi.revoked_at is null
    and pi.deleted_at is null
    and pi.expires_at > now()
    -- Mandatory here, unlike the token path: an id is guessable in a way a
    -- 32-byte token is not, so the address is what authorises this route.
    and pi.invited_email is not null
    and pi.invited_email = coalesce(current_email, '')
  limit 1;

  if invitation.id is null then
    raise exception 'invitation is invalid, expired, already used, or for a different email address';
  end if;

  -- Same defence in depth as the token path: the inviter must STILL be
  -- entitled to grant access, or an invitation minted by someone since
  -- demoted would keep working.
  if not exists (
    select 1
    from public.properties p
    where p.id = invitation.property_id
      and p.deleted_at is null
      and (
        p.owner_user_id = invitation.inviter_user_id
        or exists (
          select 1
          from public.property_members pm
          where pm.property_id = p.id
            and pm.user_id = invitation.inviter_user_id
            and pm.deleted_at is null
            and pm.role in ('owner', 'co_owner')
        )
      )
  ) then
    raise exception 'the person who sent this invitation can no longer grant access to this home';
  end if;

  perform set_config('app.accepting_property_invitation', 'on', true);

  insert into public.property_members (property_id, user_id, role, deleted_at)
  values (invitation.property_id, auth.uid(), invitation.role, null)
  on conflict (property_id, user_id)
  do update set
    role = excluded.role,
    deleted_at = null,
    updated_at = now();

  perform set_config('app.accepting_property_invitation', 'off', true);

  update public.property_invitations
  set accepted_at = now(),
      accepted_by = auth.uid(),
      updated_at = now()
  where id = invitation.id;

  return invitation.property_id;
end;
$function$;

revoke execute on function public.accept_pending_invitation(uuid) from public, anon;
grant execute on function public.accept_pending_invitation(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
