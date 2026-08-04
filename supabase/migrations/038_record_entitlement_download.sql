-- 038: actually write entitlement_downloads.
--
-- 022 created the table with the right policies and then nothing ever inserted
-- a row, so 037 had to mark it RESERVED. It is the post-purchase access log
-- Stripe asks for as dispute evidence on digital goods, and unlike almost
-- everything else in this schema it cannot be reconstructed after the fact —
-- the day a chargeback arrives is the day it is too late to start collecting.
-- Money went live 2026-08-03, so the clock is running.
--
-- Two changes:
--
-- 1. A `context` column. "This user downloaded something" is weak evidence;
--    "this user printed the handover pack for 12 Oak St at 14:02" is the
--    thing a bank reads. Nullable so the existing insert policy still works.
--
-- 2. `record_entitlement_download(text, text)` — a SECURITY DEFINER recorder
--    that resolves the caller's active entitlement itself. The existing
--    insert policy already stops a user recording against an entitlement they
--    do not hold, but it requires the client to know the entitlement id,
--    which means selecting it first and trusting the client to pass the right
--    one back. Taking only a product key and deriving identity from auth.uid()
--    internally removes that round trip and the shape of hole that comes with
--    it — same reasoning as has_entitlement in 022.
--
-- Returns true when a row was written, false when the caller holds no active
-- entitlement for that product. Callers treat it as fire-and-forget: failing
-- to log must never block a paying customer from getting their document.

alter table public.entitlement_downloads
  add column if not exists context text;

comment on column public.entitlement_downloads.context is
  'What was exercised, e.g. ''handover_pack_print'' or ''account_archive_zip''. '
  'Free-text on purpose — this is evidence for a human reading a dispute.';

create or replace function public.record_entitlement_download(
  p_product_key text,
  p_context text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entitlement_id uuid;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    return false;
  end if;

  -- Most recent active entitlement for this product. A user can legitimately
  -- hold more than one (a per-home subscription per home); any of them proves
  -- the purchase, so the newest is as good as another.
  select e.id into v_entitlement_id
  from public.entitlements e
  where e.user_id = v_user_id
    and e.product_key = p_product_key
    and e.status = 'active'
    and (e.expires_at is null or e.expires_at > now())
  order by e.created_at desc
  limit 1;

  if v_entitlement_id is null then
    return false;
  end if;

  insert into public.entitlement_downloads
    (entitlement_id, user_id, product_key, context)
  values
    (v_entitlement_id, v_user_id, p_product_key, left(p_context, 200));

  return true;
end;
$$;

revoke execute on function public.record_entitlement_download(text, text) from public, anon;
grant execute on function public.record_entitlement_download(text, text) to authenticated, service_role;

-- The table is no longer reserved.
comment on table public.entitlement_downloads is
  'Post-purchase access log — the evidence Stripe asks for when disputing a '
  'digital-goods chargeback. Written by record_entitlement_download() at the '
  'moment a paid artifact is produced. Read-your-own via RLS; never deleted.';

notify pgrst, 'reload schema';
