# Supabase Setup

This project includes Supabase schema, RLS, private Storage, invitation-backed sharing, and an account-deletion Edge Function. Demo mode still uses localStorage when Supabase is not configured or the user is signed out.

## 1) Create a Supabase project

1. Go to Supabase dashboard.
2. Create a new project.
3. Wait for database provisioning.

## 2) Get project URL and anon key

From Project Settings → API:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 3) Configure environment variables

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do not add service role keys to frontend env files.

## 4) Run migrations

Using Supabase CLI:

1. `supabase login`
2. `supabase link --project-ref <your-project-ref>`
3. `supabase db push`

This applies migrations under [supabase/migrations](../supabase/migrations).

## 5) Deploy Edge Functions

Deploy `delete-account` before enabling account deletion in a hosted environment:

1. `supabase functions deploy delete-account`
2. Set function secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

The service-role key must live only in Supabase function secrets, never in frontend env files.

## 6) Security warning

- Never commit real secrets.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code.
- Frontend must use anon key only.
- Run the hosted `pg_policies` inventory query in `SECURITY.md` after applying `010_security_privacy_sharing.sql`.

## 7) Current app behavior

- Signed-in users save MVP data to Supabase.
- Demo mode stores browser-only localStorage data and is not encrypted.
