# Security Summary

## Core rules

- Do not commit secrets (service role keys, private keys, OAuth secrets).
- Frontend apps may only use:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Never place `SUPABASE_SERVICE_ROLE_KEY` in frontend code or frontend env files.

## Data protection model

- Row Level Security (RLS) is required on all private data tables.
- No anonymous reads for private household/property data.
- Viewers are read-only.
- Maintenance guest access is restricted and must not grant broad whole-home visibility.
- Use role-scoped policies for write actions (`owner`, `co_owner`, `editor`).
- Private record visibility is enforced in the database. A row marked private/personal archive is readable only by its creator plus the property owner/co-owners.
- Family, maintenance, buyer, and insurance contexts are enforced by RLS for the corresponding member roles.
- Property membership changes and invitations are owner/co-owner managed. Editors cannot self-promote, delete properties, or grant owner/co-owner roles.

## Hosted database remediation

Before any non-local use, run this in the hosted Supabase SQL editor and confirm no quarantined `001_init.sql` policies remain:

```sql
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Apply `010_security_privacy_sharing.sql` to drop legacy policies, enforce role hierarchy, add invitation-backed sharing, and enforce visibility-aware RLS.

## Hosted auth settings (dashboard only)

These live in the Supabase dashboard, not in this repo. `supabase/config.toml`
is the **local** stack's config — it carries the same hardening flags so local
dev matches intent, but do **not** run `supabase config push` with it: its
`site_url` and `additional_redirect_urls` point at `127.0.0.1`, and pushing
them would repoint production password-reset and OAuth callbacks at localhost.

Checklist (Authentication → Sign In / Providers, and → Attack Protection).
None of these cost anything — all are included in the plan already being paid
for:

| Setting | Target | Why |
|---|---|---|
| **Confirm email** (`mailer_autoconfirm` off) | **ON** | Currently OFF in production, so an address in `auth.users` has never been proven. Anyone can sign up as someone else's address. This is the highest-value one. |
| Leaked password protection (HaveIBeenPwned) | ON | Blocks passwords already known to be breached — the single cheapest defence against credential stuffing. |
| MFA — TOTP (app authenticator) | Enrol + verify ON | Opt-in per user; forces nothing on anyone. |
| Secure password change (require recent login) | ON | A lifted session must not be able to change the password and lock the owner out. |
| Password requirements | Letters + digits, min 8 | Matches `config.toml`. |
| CAPTCHA (Turnstile) | Consider | Free from Cloudflare, but adds a third-party script to the auth pages — it needs a matching `script-src`/`frame-src` entry in the CSP in `apps/web/next.config.js`, which is now **enforcing**. Do the CSP edit in the same change or sign-in will break. |

**Why `mailer_autoconfirm` matters beyond sign-up:** the Stripe webhook resolves
an unattributed purchase by email. Migration 035 requires
`email_confirmed_at is not null` before it will credit anyone, so an unverified
address can no longer claim someone else's payment — the purchase lands in
`unmatched_purchases` for a human instead. Turning email confirmation on
restores that fallback to full usefulness.

## CSP: why `script-src` still allows `'unsafe-inline'`

The CSP in `apps/web/next.config.js` is **enforcing** as of 2026-08-04. It
still carries `'unsafe-inline'` in `script-src`, and that is not laziness —
it was investigated and is currently unavoidable:

Every HTML response contains exactly one executable inline script, and it is
injected by **Cloudflare**, not by Next.js:

```
window.__CF$cv$params={r:'a25c0e0c8fba7b20',t:'...'}
```

The `r` value is a per-request ray ID, so the script body differs on every
response. A hash cannot cover it (the body changes), and a nonce cannot either
(these pages are statically prerendered, so there is no per-request server
render in which to mint one). Next's own inline output is `__NEXT_DATA__` with
`type="application/json"` and the JSON-LD block with
`type="application/ld+json"` — neither is executable, so neither needs a
`script-src` allowance.

**This was tried and it did not work — do not repeat it.** On 2026-08-04 the
obvious remedy was attempted on this zone: Bot Fight Mode turned **off** (and
cycled off/on/off), AI Labyrinth turned **off**, AI-bot blocking set to
**Allow**, and the Cloudflare cache purged. The injection persisted for 30+
minutes, for both `curl` and a real browser. A re-check on **2026-08-05** — more
than a day later, far beyond any propagation window — found the script still
present on `/`, `/pricing` and `/sign-in`:

```
for p in "" "pricing" "sign-in"; do curl -s "https://ourhomefolder.com/$p" | grep -c 'CF$cv$params'; done
# 1 1 1
```

The conclusion is that this zone's injection comes from Cloudflare's automated
("always protected") security layer, which has **no customer-facing off switch**.
There is therefore no configuration that lets us drop `'unsafe-inline'` from
`script-src` while the site stays behind Cloudflare. The allowance is an
**accepted, compensated risk** (see the residual-risk paragraph below), not a
pending task.

Because the strict CSP is off the table anyway, the bot protections that were
disabled during this investigation buy us nothing by staying off — Bot Fight
Mode should be turned back **on** (Security → Settings), and AI Labyrinth and
AI-bot blocking ("Block on pages with ads") restored if wanted. This matters:
the app has no rate limiting of its own on the auth endpoints beyond Supabase's
per-IP limits.

If Cloudflare ever does expose a switch for this layer, the verification step is
`pnpm --filter @home-folder/web verify:csp`, which fails if any un-hashed
executable inline script is present.

**Residual risk while it stays:** an injected inline script is not blocked by
CSP, and Supabase sessions live in `localStorage`, so an XSS is account
takeover. The compensating controls are that the app has exactly one HTML sink
(`lib/json-ld.ts`, which escapes `< > & U+2028 U+2029` and is fed only
developer-controlled data) and that the storage bucket's MIME allowlist
excludes `image/svg+xml` and `text/html`. `style-src 'unsafe-inline'` stays
regardless — the app uses inline style attributes throughout, and style
injection is the far weaker of the two risks.

## Private data rules

The application must not store sensitive home-access secrets in user data fields, including:

- access codes
- lock codes
- garage codes
- safe codes
- alarm codes
- Wi-Fi passwords
- hidden key locations

## Storage rules

- Do not store user files in public buckets.
- Keep user documents private by default.
- Document signed URLs should request attachment/download behavior with sanitized filenames.
- Asset manual/support URLs must be HTTP(S)-only. `javascript:`, `data:`, and other schemes are rejected on write and guarded on render.

## Account lifecycle

- Account deletion is implemented through the `delete-account` Supabase Edge Function. The service-role key must exist only in the function environment.
- The deletion flow removes memberships, anonymizes the profile, transfers owned homes to an available co-owner, soft-deletes ownerless homes, and deletes the Auth user.

## Demo mode

- Demo data is stored in browser localStorage and is not encrypted.
- Demo mode must not be used for sensitive home-access details, passwords, codes, or hidden-key locations.

Developers should use `.env.example` and local environment variables for local setup.

## Home Automation module

- All 15 `automation_*` tables are property-scoped with RLS via
  `is_property_member` (read) / `is_property_editor` (write). Verified live:
  the anon role receives `[]`, and the security advisor report is unchanged
  from baseline (no new lints, no RLS gaps).
- **Secrets are never stored.** Only *reference* fields are kept
  (`credential_reference`, `account_reference`, `service_account_reference`) —
  e.g. a password-manager item name. Wi-Fi passwords, alarm/door codes, API
  keys, recovery codes, and tokens must never be entered.
- Exports exclude credential references by default; the owner can opt in per
  export. Free-text (reset/handover/troubleshooting notes) is scrubbed with the
  shared `safeText()` before it appears in exports or the emergency guide.
- The emergency & handover report excludes sensitive fields by design.
