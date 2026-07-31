# User journeys

Written 2026-07-30. Every persona's path through the product, the moment each
one converts, and where each journey is enforced in code. Companion to
DECISIONS.md (why) and PRICING_AND_PLANS.md (what they pay).

The one-sentence product: **a permanent, structured, exportable record of a
physical home — rooms, systems, appliances with serials, shut-offs,
maintenance history, documents — that generates the right view of itself for
whichever audience needs it** (family, buyer, technician, insurer, tenant,
city inspector).

---

## Persona 1 — The homeowner (free, forever)

The top of the funnel and the soul of the product. They never pay a
subscription (DECISIONS.md D-14); they may buy one-time packs at life moments.

```
Discover → Try without signing up → Sign up (keep data) → First-run setup
→ Document over time → A moment arrives → Export / share / buy a pack
```

1. **Discover.** Today: word of mouth; the marketing site is still unbuilt
   (the top launch blocker, NEEDS_JESSE.md). Planned acquisition surfaces:
   disaster-season content (see THREAT_MITIGATION T3), free recall
   monitoring, Centriq-refugee content.
2. **Try without signing up — demo mode.** With no account (or no Supabase
   configured) the entire app runs against browser localStorage
   (`lib/demoStorage.ts`). Nothing is lost by exploring.
3. **Sign up and keep the work.** On first sign-in with demo data present,
   the app offers an explicit import (`DemoImportBanner`,
   `lib/demoImport.ts`). This exists because the audit found signup silently
   destroyed everything a visitor had entered (BUG-1) — the fix is a journey
   decision, not just a bug fix: *trying first is the intended path.*
4. **First-run setup (`/welcome`).** Asks for exactly two things: where the
   water shuts off and where the electrical panel is — the two facts that
   matter in an emergency. Everything else is optional and incremental.
5. **Document over time.** Rooms → utilities → assets (serial numbers,
   warranties) → documents/photos → repairs and service history. The
   dashboard's completeness card (`lib/completeness.ts`) always proposes the
   next single step. Reminder emails (monthly digest, built and inert until
   Resend keys exist) pull them back.
6. **The moments.** Everything before this was deposit; these are withdrawal:
   - **Emergency** — `/emergency`: shut-offs in one screen.
   - **A technician visit** — Service Call Sheet (`/repairs/[id]/service-call`):
     a scrubbed, pre-addressed text/email with exactly what the plumber
     needs, secrets redacted.
   - **Sharing** — `/sharing`: invite family (editor/viewer), a technician
     (maintenance_guest), a buyer (buyer_preview), an insurer
     (insurance_view). Roles are database-enforced, not UI filters.
   - **Selling** — `/handover`: the Handover report; later, the paid
     Handover Pack and (Phase 4) live record transfer to the buyer.
   - **A claim** — the insurance report; the Claim-Ready Pack (Phase 1)
     formats the inventory the way adjusters ask for it.
   - **Leaving the platform** — Settings → Download your data. Full export,
     deliberately unredacted, including uploaded files (Phase 1). The
     export is a *feature of the promise*, not an apology (D-16).

**Conversion moment:** homeowners convert to *buyers of a pack* at a life
moment (sale, claim), or to Persona 2 when they acquire a second property.

## Persona 2 — The landlord / small operator (the paying tier)

1–50 doors. Documented in depth in PORTFOLIO.md; the journey:

```
Homeowner outgrows one home → adds 2nd property (free) → hits the 3rd door
or first building → Portfolio plan ($29/mo) → per-unit records → the three
landlord moments
```

1. **Graduation.** The same account that documented their home adds a rental
   (`FREE_PROPERTY_ALLOWANCE = 2` keeps home + one more free). The third
   door — or the first apartment building — is the plan boundary.
2. **Portfolio setup (`/portfolio`).** Add a building, bulk-add units (one
   label per line). A unit *is* a property (D-19): it inherits every feature
   the house had. The header switcher moves between doors; the portfolio
   dashboard rolls up open repairs, reminders, expiring warranties, aging
   equipment, and compliance across all of them.
3. **The three landlord moments** (each maps to a table shipped in
   migration 023):
   - **Turnover** — `tenancies` + `/condition-reports`: move-in walkthrough
     with per-room photos and automatic timestamps; move-out before and
     after repairs; one-click printable **deposit packet** (the CA AB 2801
     evidence chain).
   - **Compliance deadlines** — `/compliance`: registration renewals, lead
     certs, inspection cycles, with retention rules and official-source
     templates. Missed deadlines block licenses; this is why they pay.
   - **The vendor visit** — same Service Call Sheet as Persona 1, now with
     the unit's exact context.

**Conversion moment:** the gate at door #3 — but only once Stripe exists;
until then gating is soft by design (D-15).

## Persona 3 — The invited guest (never pays, makes owners stickier)

Six invited roles, each seeing a database-enforced slice:

- **co_owner / editor / viewer** — family and co-owners; the whole record
  (viewer read-only).
- **maintenance_guest** — a technician: relevant systems, repairs, service
  history; *not* the whole-home room archive, network credentials, costs, or
  contractor contacts.
- **buyer_preview** — a serious buyer mid-transaction: rooms, systems,
  warranties, service history; no receipts, no private notes.
- **insurance_view** — an adjuster: repairs, service records, insurance-
  context documents.

Journey: receive link → `/accept-invite` (explicit accept; email-pinned if
the inviter set one; token single-use, hashed at rest) → scoped view. Guests
are an acquisition surface: every technician and buyer who sees a
well-documented home meets the product.

## Persona 4 — The professional channel (Phase 5, designed not built)

Inspector or agent. Journey per THREAT_MITIGATION T6: pro builds a pre-seeded
record during the inspection → pays per binder ($10–25, the RecallChek-proven
SKU) → hands the buyer a co-branded claim code → buyer becomes owner of a
live record (Phase 4 transfer primitive) → pro keeps a branded viewer seat.
The homeowner starts at Persona 1 step 5 with a full record on day one.

## Persona 5 — The organization itself (Jesse)

Founder metrics live in the private `metrics` schema (signup funnel,
activation = property + 2 record kinds within 7 days, write retention) —
no third-party tracker, no cookie banner (D-13). Operations run through
ACTIVATION_RUNBOOK.md and NEEDS_JESSE.md.

---

## Journey-to-code index

| Journey step | Where it lives |
|---|---|
| Demo mode | `apps/web/lib/demoStorage.ts`, `lib/dataContext.ts` |
| Demo → account import | `lib/demoImport.ts`, `components/DemoImportBanner.tsx` |
| First-run | `pages/welcome.tsx` |
| Next-step nudge | `lib/completeness.ts`, dashboard top card |
| Sharing roles | `lib/sharing.ts` (ROLE_PROFILES), migration 015 RLS |
| Service Call Sheet | `lib/serviceCall.ts`, `pages/repairs/[id]/service-call.tsx` |
| Handover reports | `lib/handover.ts`, `pages/handover.tsx` |
| Export | `lib/accountExport.ts`, Settings |
| Portfolio | `lib/portfolio.ts`, `pages/portfolio.tsx`, migration 023 |
| Tenancies / condition / compliance | `lib/tenancies.ts`, `lib/conditionReports.ts`, `lib/compliance.ts` + pages |
| Entitlements / plans | `lib/entitlements.ts`, migration 022/023, `stripe-webhook` |
| Digest emails | migration 021, `supabase/functions/send-digest` |
| Metrics | migration 020, `metrics` schema |
