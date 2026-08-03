-- 028: link a utility record to the smart home device it describes.
--
-- Smoke/CO detectors and water/sprinkler shutoffs are both smart home devices
-- and critical utilities. Recording one thing twice by hand was the old
-- workflow; now adding such a device also creates its utility record, and this
-- column is the link between the two (2026-08-03).
--
-- on delete set null: removing the device keeps the utility — the physical
-- shutoff still exists even if its smart controller is retired.

alter table public.utilities
  add column if not exists device_id uuid references public.automation_devices(id) on delete set null;

create index if not exists utilities_device_id_idx on public.utilities(device_id);
