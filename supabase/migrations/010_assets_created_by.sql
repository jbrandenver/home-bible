-- Add created_by to assets.
-- The web app's ASSET_SELECT already reads this column (apps/web/lib/assets.ts),
-- but no prior migration created it, so asset queries failed with 42703.
-- Additive and non-destructive; RLS policies are unchanged.

alter table public.assets
  add column if not exists created_by uuid references public.profiles(id) on delete set null;
