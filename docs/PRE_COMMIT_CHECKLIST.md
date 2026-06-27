# Pre-Commit Checklist

Run this checklist before committing Home Bible changes.

## Security

- Did `git status` show only intended files?
- Did this avoid committing `.env` files?
- Did this avoid adding service role keys or private secrets?
- Did this preserve RLS for Supabase tables?
- Did this avoid storing sensitive home access details?
- Did this keep private user files in private storage?
- Did this avoid public file URLs for private files?

## Cost

- Did this add a new paid service?
- Did this add a Supabase Edge Function?
- Did this add a scheduled job?
- Did this add realtime?
- Did this add AI/OCR/vector search?
- Did this add storage usage?
- Did this add a new bucket?
- Did this add larger upload limits?
- Did this add a GitHub Action?
- Did this add a preview branch?
- Did this add test users or seed data?
- Did this leave local or remote stale branches?
- Did this require a Supabase dashboard cleanup?
- Did this document expected cost impact?

## Verification

- Did `corepack pnpm --filter @home-bible/web build` pass?
- Did affected routes or workflows get smoke tested?
- Did docs mention any manual Supabase SQL steps if needed?
- Did migrations avoid dropping production data?
- Did any cost-impacting change get explicit approval?
