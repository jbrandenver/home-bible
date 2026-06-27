# Cost Governance

Home Bible is cost-first during MVP. Every implementation decision should prefer the smallest durable surface that proves the product need without creating recurring usage, background processing, duplicate infrastructure, or paid-service dependency.

## Standing Rule

Every future Codex prompt must include a Cost Impact section. If a change could increase Supabase, GitHub, storage, email, AI, OCR, logs, background-job, or hosting costs, Codex must stop and ask for approval before implementing that part.

## Build Principles

- Every new phase must include a cost impact section before implementation.
- Avoid paid or usage-based services unless explicitly approved.
- Avoid Supabase Edge Functions unless required and approved.
- Avoid scheduled jobs and cron unless explicitly approved.
- Avoid Supabase Realtime unless required and approved.
- Avoid vector, AI, and OCR features unless explicitly approved.
- Avoid public storage buckets.
- Avoid duplicate storage buckets.
- Avoid large file uploads without explicit limits.
- Avoid keeping stale preview branches.
- Avoid unused Supabase branches.
- Avoid orphaned test data.
- Avoid unnecessary auth test users.
- Avoid excessive logs.
- Avoid automatic background processing.
- Prefer local and manual workflows until the product need is proven.
- Prefer one Supabase project and one GitHub main branch during MVP.
- Document cost risks before implementation.

## Cost Approval Required

Future phases must stop and ask for approval before implementing:

- Supabase Edge Functions
- Supabase cron or scheduled jobs
- Supabase Realtime
- Supabase branching or preview branches
- Custom SMTP
- AI, OCR, embeddings, or vector search
- Third-party APIs
- Paid hosting changes
- Public production deployment
- GitHub Actions that run automatically
- Large-file support over current limits
- Additional storage buckets
- Batch or background processing
- Email notifications
- Push notifications
- SMS
- Analytics or event tracking tools
- Error monitoring tools with usage billing

## Safe By Default

Allowed without extra cost approval:

- Local docs
- Local scripts that do not call paid APIs
- UI-only changes
- Supabase table changes with RLS and no background jobs
- Small private metadata tables
- Private storage using the existing bucket and current limits
- Manual user-triggered actions
- Build and test commands
- Git cleanup recommendations

## Required Cost Impact Choices

Every phase plan must choose exactly one:

- No new cost expected
- Minimal storage/database growth only
- Potential cost increase, requires user approval before implementation

If the choice is "Potential cost increase," do not implement the cost-increasing part until approval is explicit.
