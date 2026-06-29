# MVP Scope

This document defines the Home Bible private MVP release-candidate scope.

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
- Automatic seed data

## Release-Candidate Boundary

The private MVP release candidate is a local/private validation package. It should prove the core homeowner workflow with realistic manual data before adding new product capabilities or deployment infrastructure.
