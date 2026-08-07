# MVP Scope

This document defines the Home Folder private MVP release-candidate scope.

## Current MVP Capabilities

- Auth
- Property onboarding
- Floors and rooms
- Home map
- Utilities
- Assets
- Warranties
- Reminders
- Repairs
- Service records
- Issues
- Trend flags
- Private documents
- Receipt approval workflow
- Home Handover
- Sharing and access review preview
- MVP test plan

## Capability Notes

### Auth

Users can sign up, sign in, sign out, and use demo mode when signed out.

### Property Onboarding

Users can create a property with a nickname and property type. Street address remains optional.

### Floors, Rooms, And Home Map

Users can create rooms and organize them into simple floor labels. The MVP does not include an exact CAD-style floor plan.

### Utilities

Users can document major home utilities and safe location notes.

### Assets And Warranties

Users can track major assets, warranty dates, manuals, and support links.

### Reminders

Users can track recurring and one-time home maintenance reminders.

### Repairs And Service Records

Users can track open repairs and completed service history.

### Issues And Trend Flags

Users can track problems and identify recurring patterns.

### Private Documents

Users can upload private homeowner documents to the existing private storage bucket and view them through signed access.

### Receipt Approval Workflow

Users can upload receipt files, review structured metadata, and save receipt records only after approval.

### Home Handover

Users can generate browser-only, print-friendly reports for family, buyer, maintenance, insurance, or personal archive use.

### Sharing And Access Review Preview

Users can preview future role visibility without sending invitations, creating guest access, or creating public links.

### MVP Test Plan

Users and testers can use `/mvp-test` and the docs checklist to validate the private MVP manually.

## Explicitly Out Of Scope

> **Stale, 2026-08-06.** This list described the *private MVP* and has since been
> overtaken. Email sending, AI/OCR parsing, Supabase Edge Functions, scheduled
> jobs, GitHub Actions and production deployment have all shipped. Treat it as
> a record of the original boundary, not as a current constraint. Two entries
> are corrected below.

- Public sharing
- Real guest invitations
- Email sending
- Push notifications
- AI/OCR parsing
- Billing
- Partner recommendations
- Gmail/Outlook inbox connection
- Exact CAD floor plan
- Public file links
- Production deployment
- Mobile native app release
- Supabase Edge Functions
- Scheduled jobs or cron
- Realtime subscriptions
- New storage buckets
- GitHub Actions
- External APIs
- ~~Automatic seed data~~ — **reversed, 2026-08-06.** First-run setup now
  pre-fills a room and system list from the property type and asks the person
  to correct it. This is not seed data in the sense meant here: nothing is
  created that they did not see and tick, and the grid starts from *their*
  answer about what kind of home it is. The original objection — inventing
  records nobody asked for — still stands and still applies to anything that
  would write without being shown first. See `apps/web/lib/starterTemplates.ts`.
- ~~Address / property-data lookup~~ — **ruled out, 2026-08-06.** No
  Estated/ATTOM/Rentcast-class vendor and no listing-site scrapers. The room
  grid derives from property type and what the person ticks, not from a
  purchased beds/baths record.

## Release-Candidate Boundary

The private MVP release candidate is a local/private validation package. It should prove the core homeowner workflow with realistic manual data before adding new product capabilities or deployment infrastructure.
