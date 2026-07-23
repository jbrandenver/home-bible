# Authorization & IDOR Guide: "Authenticated" Is Not "Authorized"

**The rule in one sentence: checking that *someone* is logged in never proves
they may touch *this specific object* — every route that takes an object ID
needs a second, object-level check.**

Companion to `ENDPOINT_AUTH_SECURITY.md` (who may call the endpoint at all)
and `FORM_VALIDATION_SECURITY.md` (what they may send). This guide covers the
layer after both: which *objects* the verified caller may read, change, or
delete.

---

## The bug

```typescript
// app/api/documents/[id]/route.ts — "secured" but not really
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // Any logged-in user reaches this line — including your cheapest,
  // lowest-trust account. Nothing checks WHOSE document this is.
  await db.documents.delete({ where: { id } })

  return Response.json({ success: true })
}
```

Every manual test passes: log in, delete your own document, it works. The bug
only appears when someone deletes *someone else's* document by ID — which
works exactly the same way. `GET` and `PATCH` variants are worse because
they're silent: any authenticated user reads or edits any tenant's private
data just by changing an ID.

Why it keeps happening: authentication is one reusable check that looks
identical everywhere, so scaffolding (AI or human) reproduces it faithfully.
Authorization is different on every route — ownership? team membership?
role? — so it requires reasoning about the data model each time, and that's
the step that gets skipped. A route that "has security code" at the top is
paradoxically harder to flag in review. Copy-paste drift then spreads the
gap: one route does the assignment check correctly, its three siblings get
scaffolded by analogy without it.

Impact: cross-tenant data exposure, scriptable mass deletion (iterate IDs
1..N), invisible in normal QA, and far worse when IDs are sequential or
guessable.

---

## The fixes, strongest-first

### Fix 1 — Scope the query to the owner (prefer this)

For plain ownership models, don't check-then-act — make ownership part of the
query itself. Atomic, no race window, no extra round trip, impossible to
forget in the code path that matters:

```typescript
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Ownership is part of the WHERE clause — deleting someone else's row
  // simply matches nothing.
  const { count } = await db.documents.deleteMany({
    where: { id, ownerId: user.id },
  })

  // 404, not 403: don't reveal that the object exists but belongs to
  // someone else. "Not yours" and "not there" should be indistinguishable.
  if (count === 0) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({ success: true })
}
```

Supabase query version:

```typescript
const { data, error } = await supabase
  .from('documents')
  .delete()
  .eq('id', id)
  .eq('owner_id', user.id)   // the authorization, in the query
  .select('id')

if (error) return jsonError(500)
if (!data?.length) return Response.json({ error: 'Not found' }, { status: 404 })
```

### Fix 2 — Row Level Security (Supabase projects)

RLS is this exact check, enforced in the database, on every query, including
ones you haven't written yet:

```sql
alter table documents enable row level security;

create policy "owners read their documents"
  on documents for select using (owner_id = auth.uid());

create policy "owners modify their documents"
  on documents for update using (owner_id = auth.uid());

create policy "owners delete their documents"
  on documents for delete using (owner_id = auth.uid());
```

For RLS to protect a request, the query must run as *that user* — a client
built with the anon key plus the caller's JWT:

```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: request.headers.get('Authorization')! } },
})
// Queries through this client are automatically scoped by RLS.
```

**The trap: `supabaseAdmin` (service-role key) bypasses RLS on every query.**
The moment a route handler uses the admin client to touch user data, you have
opted out of the database's authorization and *you* are the access check. In
Supabase apps, "IDOR" is usually spelled "used the service-role client for
convenience." Rules:

- Default to the user-scoped client in request handlers; RLS does the work.
- Reserve `supabaseAdmin` for genuinely cross-user work (webhooks, cron,
  admin dashboards) — and there, apply Fix 1 or Fix 3 manually, every time.
- RLS is also what makes browser-direct `supabase-js` queries safe. No RLS on
  a table = every row is public to any authenticated (or anon) key holder.

### Fix 3 — Central access-control helper (complex role/assignment models)

When access isn't simple ownership (teams, assignments, viewer/editor roles),
centralize the decision in one helper and call it from every route — a fix in
one place then fixes every route:

```typescript
// lib/access-control.ts
type Action = 'view' | 'edit' | 'delete'

const ROLE_ACTIONS: Record<string, Action[]> = {
  admin: ['view', 'edit', 'delete'],
  editor: ['view', 'edit'],
  viewer: ['view'],
}

export class ForbiddenError extends Error {}

export async function assertDocumentAccess(
  user: { id: string; role: string },
  documentId: string,
  action: Action
): Promise<void> {
  // 1. Can this role ever perform the action?
  if (!ROLE_ACTIONS[user.role]?.includes(action)) {
    throw new ForbiddenError(`Role ${user.role} cannot ${action}`)
  }

  // 2. Global admins skip the assignment check; scoped roles need an
  //    explicit relationship row for THIS object.
  if (user.role !== 'admin') {
    const { data } = await supabaseAdmin
      .from('document_members')
      .select('id')
      .eq('document_id', documentId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!data) throw new ForbiddenError('Not a member of this document')
  }
}
```

```typescript
// In the route — auth, then authorization, then the action:
try {
  await assertDocumentAccess(user, id, 'delete')
} catch (e) {
  if (e instanceof ForbiddenError) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  throw e
}
await supabaseAdmin.from('documents').delete().eq('id', id)
```

(Membership-style rules also express cleanly in RLS with an `exists (select 1
from document_members …)` policy — prefer that when the model fits.)

---

## Caches inherit the same bug

A cache keyed only on the object ID re-serves one user's gated content to
another, and a cache hit that returns before the access check skips
authorization entirely:

```typescript
// BROKEN: hit path never authorizes; key isn't scoped to the requester
const cached = await redis.get(`thumbnail:${videoId}`)
if (cached) return cached

// FIXED: authorize FIRST, and fold the user into the key
async function getThumbnail(user: AuthedUser, videoId: string) {
  await assertVideoAccess(user, videoId, 'view')   // before any cache read
  const key = `thumbnail:${user.id}:${videoId}`
  const cached = await redis.get(key)
  if (cached) return cached
  // …generate, cache under the scoped key, return
}
```

Same rule for CDN caching of API responses: anything per-user or gated needs
`Cache-Control: private` (or no caching) and must never vary only by object
ID.

---

## Auditing an existing codebase

```bash
# 1. Inventory every dynamic-ID route
grep -rln "params\.id\|\[id\]\|:id\b" --include="*.ts" --include="*.tsx" \
  app api server/src/routes supabase/functions 2>/dev/null | grep -v node_modules

# 2. Handlers using the service-role/admin client — each one has opted out
#    of RLS and needs a manual ownership/assignment check. Verify every hit.
grep -rn "supabaseAdmin\|SERVICE_ROLE" --include="*.ts" app api supabase/functions \
  2>/dev/null | grep -v node_modules | grep -v "lib/auth"

# 3. Mutations by bare ID — look for a where clause with NO owner/user column
grep -rn "\.delete(\|\.update(\|deleteMany(\|\.eq('id'" --include="*.ts" . \
  | grep -v node_modules | grep -viE "owner|user_id|userId|auth\.uid"

# 4. Tables without RLS (Supabase — run in SQL editor)
#   select tablename from pg_tables
#   where schemaname = 'public' and rowsecurity = false;

# 5. Cache keys missing the requesting user
grep -rn "cache\.get(\|cache\.set(\|redis\.get(\|redis\.set(" --include="*.ts" . \
  | grep -v node_modules | grep -viE "userId|user_id|user\.id"
```

Then, by hand: pick your five most sensitive object types (customer data,
billing, anything destructive) and write one plain-English sentence per type:
*"what proves this specific user may touch this specific object?"* If the
answer is "we checked they're logged in," you've found the bug.

## Checklist

- [ ] Every route taking an object ID has an object-level check — ownership in the query, RLS via a user-scoped client, or a central helper — separate from and after authentication
- [ ] `DELETE` and `PATCH`/`PUT` handlers audited first (highest impact)
- [ ] Every `supabaseAdmin`/service-role usage in a request path individually justified and paired with a manual access check
- [ ] RLS enabled on every table in `public`; browser-reachable tables have policies keyed on `auth.uid()`
- [ ] Failed authorization returns **404** (or a generic error) — not a 403 that confirms the object exists
- [ ] Object-level logic centralized, not copy-pasted per route
- [ ] Cache keys for per-user or gated content include the requesting user's ID; authorization runs before every cache read
- [ ] Sensitive object IDs are UUIDs, not sequential integers (defence in depth, not a substitute)
- [ ] Your five most sensitive object types each have a written answer to "what proves access?"

## Prompt your AI assistant

```
Audit this repository for IDOR (Insecure Direct Object Reference) and missing
object-level authorization.

For every API route or edge function that accepts an object ID (URL param like
[id] or :id, or an ID field in the body), check:

1. Authentication: is the caller verified at all? (Covered by the
   endpoint-auth audit — note gaps but don't stop there.)

2. SEPARATELY: does the handler verify this user may touch THIS object —
   ownership folded into the query's WHERE clause, RLS enforced via a
   user-scoped client, or an explicit ownership/assignment lookup — before
   reading, writing, or deleting? Flag every route with gate 1 but not gate 2.

3. Supabase specifically: flag every use of the service-role/admin client
   inside a request handler that touches user-owned data without a manual
   access check — service-role bypasses RLS. Also list public tables without
   RLS enabled.

4. Prioritize DELETE and PATCH/PUT handlers, then GET handlers returning
   private data.

5. Caching: flag cache keys built from an object ID without the requesting
   user's ID, and any cache read that happens before the authorization check.

6. Note whether object-level logic is centralized or duplicated across
   similar routes — duplication is how the next sibling route ships without
   the check.

For each finding: file and line, a concrete exploit scenario (what an
authenticated-but-unauthorized user could do), and a fix reusing the correct
access-control pattern already present in this codebase where one exists.
Do not fix anything yet — just report.
```
