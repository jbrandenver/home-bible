# MVP Seed Walkthrough

This is a manual seed guide. Do not run it automatically. Do not insert sample data into Supabase automatically. Do not upload files automatically.

Use small placeholder files for document and receipt testing. Do not add real secrets, private entry details, security credentials, or sensitive household instructions.

## Property

- Nickname: Maple House
- Property type: single_family / Single family home
- Address: skip

## Rooms

Create these rooms:

- Kitchen
- Living Room
- Primary Bedroom
- Main Bathroom
- Laundry Room
- Utility Room
- Garage
- Backyard

Suggested floors:

- Main Floor: Kitchen, Living Room, Main Bathroom, Laundry Room, Utility Room, Garage
- Second Floor: Primary Bedroom
- Exterior: Backyard

## Utilities

Add:

- Main Water Shutoff in Utility Room
- Electrical Panel in Garage
- Water Heater in Utility Room
- Furnace in Utility Room
- Router in Living Room

Use plain, non-sensitive location notes such as "left wall shelf area" or "near interior door." Do not add credentials or security instructions.

## Assets

Add:

- Refrigerator in Kitchen
- Dishwasher in Kitchen
- Washer in Laundry Room
- Dryer in Laundry Room
- Lawn Mower in Garage
- Smart Thermostat in Living Room

Suggested metadata:

- Add brand/model only if available.
- Add purchase dates where useful.
- Add warranty expiration dates for appliance records.
- Skip serial numbers if they are not needed for the test.

## Reminders

Create:

- Replace HVAC filter
- Flush water heater
- Test smoke detectors
- Winterize sprinkler system

Suggested cadence:

- HVAC filter: quarterly
- Water heater: annual
- Smoke detectors: semiannual
- Sprinkler winterization: annual or seasonal

## Repairs

Create:

- Dishwasher leak inspection
- Garage door tune-up

Use open or scheduled statuses for at least one repair so dashboard and detail pages show active work.

## Service Records

Create:

- Furnace annual service
- Water heater inspection

Link service records to the relevant utility or asset where the UI allows it.

## Issues

Create:

- Slow drain in Main Bathroom
- Small leak under Kitchen sink

Keep notes practical and non-sensitive. Link each issue to the closest room, asset, utility, or repair where possible.

## Trend Flags

Create:

- Recurring plumbing concern
- HVAC maintenance pattern

Use the trend flag flow to confirm issue patterns are readable and do not expose private notes.

## Documents

Upload small placeholder files for:

- Water heater manual
- Furnace service report
- Appliance warranty PDF

Confirm files appear as private document records. Do not expect or create public file links.

## Receipts

Upload or create receipt records for:

- Refrigerator receipt
- Dishwasher repair invoice
- Furnace service receipt

Confirm structured receipt data is saved only after user approval. Cancel one review flow and confirm no receipt row is created.

## Home Handover

Generate:

- Family report
- Buyer report

Confirm:

- Reports are browser-only.
- No report file is stored.
- Documents appear as metadata only.
- Buyer and maintenance-style outputs stay conservative.

## Sharing

Review:

- viewer role
- maintenance_guest role
- buyer_preview role

Confirm:

- Sharing is preview-only.
- No invitations are sent.
- No public links are created.
- Maintenance preview remains restricted.
- Buyer preview hides private financial receipt details by default.

## Cleanup

- Delete unneeded uploaded test files.
- Keep only one or two representative files if storage review is needed.
- Remove duplicate test records that make review noisy.
