# Launch Audit — field guide

Concrete technique for auditing a live app. Examples use Supabase/Postgres +
Next.js on Cloudflare, because that is Jesse's stack; the reasoning transfers.

---

## The 20 categories, mapped to where they actually live

Auditing "by category" produces shallow coverage because several categories
land in the same file and some land in no file at all. Map them to surfaces:

| Surface | Categories it owns |
|---|---|
| Database policies + grants | broken access control, IDOR, BOLA, function-level authz, mass assignment |
| Server endpoints / edge functions | injection, SSRF, CSRF, authn failures, unrestricted consumption, deserialization, exceptional conditions, upload/traversal |
| Config, secrets, dependencies, CI | cryptographic failures, misconfiguration, supply chain, integrity failures |
| Client bundle + browser | XSS, CSP, open redirect, client-side trust, session storage |
| Product rules + operations | insecure design, business-logic abuse, logging/alerting gaps |

**The highest-yield question in the whole audit:** *for every boundary the
product promises the user, is it enforced by the server, or only by the UI?*
Produce a table of every gated feature × where the gate lives. Anything whose
only gate is a React conditional is a finding, and this is where the real bugs
concentrate — not in exotic injection.

---

## Probing a live system

Do these yourself; they are fast and no file-reading agent can do them.

**Platform advisors.** Run the built-in security linter (Supabase
`get_advisors`) before and after. Free, and it catches RLS-less tables,
over-permissive function grants, and disabled auth protections.

**The deployed authorization matrix.** Do not read policies from migration
files and assume. Query the live catalog: every table × RLS enabled × policy
count × what `anon` and `authenticated` are actually granted. Then read the
policy expressions, then read the *helper functions* the policies call — a
clean-looking policy set can rest entirely on one helper with a self-comparison
bug.

**Column-level grants.** Table-level `SELECT` is the default and it is
all-or-nothing per row. If the product promises "guests cannot see prices",
check `information_schema.column_privileges`, not the UI code.

**Black-box the API as an anonymous caller.** With the public/anon key, try to
read every table. Expect empty arrays or permission errors. Anything that
returns data is a live leak.

**Response headers on the real domain**, including static assets. Static files
are frequently served by a different layer than the app (CDN/edge assets vs the
server), so they can miss every security header the app sets. `/sw.js` is the
sharpest case: a service worker is the most powerful script on the origin.

**Deployed versions.** List the deployed functions and compare against git.
See "Deploy topology" below.

---

## Proving an exploit safely

Never report "an editor could take over the household" without running it. In
Postgres, simulate the attacker's identity and force a rollback:

```sql
do $$
declare res text := '';
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '<attacker-uuid>', 'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  begin
    update public.households set owner_user_id = '<attacker-uuid>' where id = '<id>';
    res := 'SUCCEEDED — exploitable';
  exception when others then
    res := 'BLOCKED: ' || sqlerrm;
  end;
  perform set_config('role','postgres', true);
  raise exception 'RESULT>> %', res;   -- aborts the txn, returns the verdict
end $$;
```

`raise exception` at the end is the trick: it guarantees rollback *and* returns
the result in the error message. Do not rely on a trailing `rollback;` unless
you have confirmed the whole batch runs in one transaction — and afterwards,
**query the table to confirm nothing persisted.**

Run the same probe after the fix. "Blocked" with the expected message is the
evidence that belongs in the report.

Validate migrations the same way before applying: wrap the file in
`begin; … rollback;` and run it against production. This catches wrong column
names, wrong return types, and dependency-order errors with zero risk.

---

## Deploy topology — the mistake that hides finished work

In a monorepo, different artifacts ship through different pipelines. A push to
`main` that deploys the web app may deploy **nothing** on the backend.

Before declaring anything shipped, for each artifact ask: what deploys this,
was it triggered, and did the deployed version change? Compare the live
function versions/hashes against what you committed. Finding six security
fixes sitting in git, unshipped, hours after "shipping" them is entirely
possible.

**Ordering rule.** When a change removes something the running code uses, the
code that stops using it must ship first:

1. Deploy the app that no longer selects the columns.
2. *Then* apply the migration that revokes them.

Reversing this breaks the live site instantly. Say the ordering out loud in the
commit message and in the report.

---

## Gotchas that cost real time

- **`REVOKE SELECT (col)` is a no-op** while the role holds a table-level
  `SELECT`. Column revokes only subtract column-level grants. You must
  `REVOKE SELECT ON t` and then re-grant every column you *do* want.
- **Columns used in `WHERE`/`ORDER BY` still need `SELECT`**, even if never
  displayed. Filtering on a revoked column fails.
- **Verify column grants in both directions.** Every column the client still
  selects must be granted (or signed-in users get 403s), and every sensitive
  column must not be. Both are one SQL query against
  `information_schema.column_privileges`; run both.
- **One-time sweeps stay one-time.** A migration that revoked EXECUTE on all
  trigger functions does not cover functions created later — they arrive with
  default grants and become callable RPCs. Re-run such sweeps after adding any.
- **`CREATE OR REPLACE FUNCTION` cannot change a return type.** Fetch the live
  definition with `pg_get_functiondef` before rewriting a function; never
  reconstruct one from memory.
- **Never mechanically string-replace across source.** Replacing `'stripe'` to
  fix an import also rewrites `provider: 'stripe'` — a database column value.
  Replace with the surrounding syntax included, then grep for collateral hits.
- **Report-only CSP with no `report-uri`/`report-to` collects nothing.** It
  neither enforces nor observes. Check for the reporting directive before
  believing a "soak period" is happening.
- **CDN-injected inline scripts cannot be hashed.** Before promising to remove
  `script-src 'unsafe-inline'`, enumerate the executable inline scripts in the
  real HTML. `type="application/json"` and `application/ld+json` are *not*
  executable and need no allowance. If the only offender is injected by the CDN
  with a per-request id, no hash or nonce can cover it and dropping
  `'unsafe-inline'` is a CDN setting, not a code change.
- **Local config files are not production config.** A `config.toml` that also
  drives local dev will contain localhost URLs; pushing it wholesale can
  repoint production auth callbacks at `127.0.0.1`. Prefer surgical API calls,
  or hand the owner a checklist.
- **Auto-confirmed email undermines email-based identity.** If the platform
  auto-confirms signups, any address in the users table is unproven — so any
  "match the buyer by email" logic is spoofable. Require an explicit
  `email_confirmed_at` check, and fail into a manual-review table.

---

## Credentials and blast radius

- Never print a secret value, in any output, ever. Reference variable names and
  locations. If a value is seen, flag it for rotation.
- Search git **history**, not just the worktree — a secret in history is live.
- Do not extract credentials from keychains or credential stores to widen your
  own access. If a task genuinely needs an API token you do not have, stop and
  say so; hand over an exact command or checklist instead. A blocked action is
  a boundary, not an obstacle to route around.
- Prefer read-then-write. If you cannot read the current production value of a
  setting, do not blind-write it.

---

## E2E checklist

Drive the real UI. Prefer the app's demo/unauthenticated mode when you cannot
sign in.

**Per page:** it loads (correct status), renders its heading and real content,
no console errors, no error-boundary text, and no dead internal links. Sweep
every route for status codes first — a 404 on a route that nothing links to is
fine; a 404 on a linked route is a bug.

**Lists and groupings:** create data and confirm counts and groupings update
everywhere it is aggregated (list page, dashboard tiles, map/summary views).
Exercise every filter, including one that should return zero, and every sort.

**Connected records:** link a record to another, confirm it appears on both
sides. Then **delete one side and confirm the other renders safely** — a
dangling reference is the classic crash, and "shows as Unknown" is the pass
condition.

**Buttons:** every destructive action prompts for confirmation; status controls
persist and update derived fields (e.g. completing an item stamps its
completion date); back navigation restores the previous view with its state.

**Empty and stale states:** every list with zero rows says something useful,
and nothing shows a stale count after a delete.

**Security behaviour is part of E2E.** If the product offers scoped sharing,
render each scope and assert the private fields are absent — and assert they
*are* present for the owner, so you catch over-redaction too.

**When you cannot sign in,** prove the authenticated data layer instead:
simulate a real user's JWT in a rolled-back transaction and assert the owner
sees privileged fields while a guest role sees none. Then state explicitly, in
the report, that a human still needs one signed-in click-through.
