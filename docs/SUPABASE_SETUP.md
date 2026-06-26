# Supabase Setup (Phase 6A)

This project now includes Supabase schema + RLS foundations while UI persistence still uses localStorage.

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

## 5) Security warning

- Never commit real secrets.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code.
- Frontend must use anon key only.

## 6) Current app behavior

- Existing routes continue using localStorage.
- Supabase integration for route-level persistence is planned for Phase 6B.
