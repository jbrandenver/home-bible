-- Scheduled service visit (share-with-technician feature, 2026-07-29):
-- a repair can record when the technician is expected so the service call
-- sheet can say "XYZ Repair · Wed Jul 30 · 8am-12pm" instead of relying on
-- whoever is home to remember.
--
-- Idempotent: add column if missing; bound the text column like
-- 013_text_length_bounds.sql does for every other text column.

alter table public.repairs
  add column if not exists scheduled_date date,
  add column if not exists scheduled_window text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'repairs_scheduled_window_maxlen'
  ) then
    alter table public.repairs
      add constraint repairs_scheduled_window_maxlen
      check (char_length(scheduled_window) <= 50000) not valid;
  end if;
end $$;
