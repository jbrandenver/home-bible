# Endpoint Authentication & Authorization Guide

**The rule in one sentence: every endpoint must answer "who is allowed to call
this?" — including the ones you think are internal-only.**

AI coding tools (and tired humans) happily ship an endpoint that does something
powerful — sends an email, writes to the database, triggers a side effect —
without an auth check, because the happy path never exercises an
unauthenticated request. The endpoint is functionally complete and
security-incomplete at the same time, and both look identical in a quick test.

Companion to `FORM_VALIDATION_SECURITY.md` (validation, sanitization, spam
defences, rate limiting). This guide covers the layer in front of that:
authentication and authorization.

---

## The four failure modes

### 1. The open internal endpoint

A webhook handler calls a second endpoint ("send welcome email") over HTTP.
The second endpoint has no auth because "only the webhook calls it." But it's
publicly reachable, and URLs leak — dev tools, source maps, logs, guessing.
Anyone who finds it can send branded email **from your domain** to any address
with any content: a phishing tool with your sender reputation attached, plus
quota burn and deliverability damage for all your legitimate email.

### 2. Identity from the request body

```typescript
// BROKEN: anyone can impersonate anyone by editing the JSON they send
const { userId } = await request.json()
await db.profiles.update({ where: { id: userId }, data: { marketing: true } })
```

`userId`, `email`, and `role` must come from a **verified session or token**,
never from the body or query string. Body-supplied identity is an
impersonation and data-enumeration bug, full stop.

### 3. Unverified webhooks

A `/api/stripe-webhook` route that trusts its payload without checking the
provider's signature lets anyone forge a "payment succeeded" event and get
whatever your fulfilment code grants — free products, credits, emails.

### 4. Header injection into outgoing email

String-interpolating user input into raw email headers lets
`"Hi\r\nBcc: victim@evil.com"` turn your contact form into a spam relay.
Defences (schema-level newline rejection + `sanitizeLine` stripping at the
send boundary) are in `FORM_VALIDATION_SECURITY.md` — use both layers.

---

## Decision table

| Who should call it? | Pattern |
|---|---|
| A logged-in user | Verified session/JWT; identity derived from the token |
| Only your own code, same codebase | **Don't make it an endpoint.** Call the function directly |
| Another service you run | Shared secret header, constant-time check, fail closed |
| A third-party provider (Stripe, GitHub…) | Verify the provider's webhook signature on the raw body |
| An admin | Verified session **plus** server-side role lookup in the DB |
| Genuinely anyone (public form) | Spam defences + rate limiting (see form guide) — "public" is a decision, not a default |

The second row is the most-missed fix: if the webhook handler and the email
sender live in the same app, `await sendWelcomeEmail(data)` removes the attack
surface entirely. Only reach for HTTP + shared secret when the caller is a
*different* deployed service.

---

## Auth helpers — `src/lib/auth.ts`

```typescript
import { createHash, timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Server-only client. SUPABASE_SERVICE_ROLE_KEY must never reach a client
// bundle — no NEXT_PUBLIC_/VITE_ prefix, imported only from server code.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export interface AuthedUser {
  id: string
  email: string | null
}

// ---- Pattern: user-facing — identity from a verified token ----------------
export async function verifyUser(request: Request): Promise<AuthedUser | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email ?? null }
}

// ---- Pattern: admin — session PLUS server-side role check -----------------
// A client-side route guard is UI, not security. The role lives in the DB
// and is checked here on every admin request.
export async function verifyAdmin(request: Request): Promise<AuthedUser | null> {
  const user = await verifyUser(request)
  if (!user) return null
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (error || data?.role !== 'admin') return null
  return user
}

// ---- Pattern: service-to-service — shared secret, fail closed -------------
// Hashing both sides before timingSafeEqual means the buffers are always the
// same length: no early-return length oracle, no throw on mismatched sizes.
const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest()

export function verifyInternalSecret(provided: string | null): boolean {
  const expected = process.env.INTERNAL_API_SECRET
  // Fail CLOSED: unset or weak secret means nobody gets in — never fail open.
  if (!expected || expected.length < 32) return false
  if (typeof provided !== 'string' || provided.length === 0) return false
  return timingSafeEqual(sha256(provided), sha256(expected))
}
```

Generate the secret once per environment (different value per environment):

```bash
openssl rand -hex 32
```

Validate required env vars at boot, not at first request — a missing
`INTERNAL_API_SECRET` should be a deploy-time failure, not a silent 401 (or
worse, a silent bypass) in production.

---

## Fixed examples — Next.js App Router

### Internal endpoint (only if it must be an endpoint at all)

```typescript
// app/api/send-welcome-email/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyInternalSecret } from '@/lib/auth'
import { sanitizeLine } from '@/lib/sanitize' // from FORM_VALIDATION_SECURITY.md

const welcomeEmailSchema = z.object({
  customerEmail: z.string().email().max(254),
  customerName: z.string().min(1).max(100).regex(/^[^\r\n]*$/, 'No line breaks'),
  courseLink: z
    .string()
    .url()
    .refine((u) => u.startsWith('https://yourdomain.com/'), 'Link must be on our domain'),
})

export async function POST(request: NextRequest) {
  // 1. Auth BEFORE any work — first line of the handler.
  if (!verifyInternalSecret(request.headers.get('x-internal-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Validate even trusted callers' payloads — the schema also pins the
  //    link to your own domain so this can never mail out attacker URLs.
  const parsed = welcomeEmailSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // 3. Strip header-injection chars at the send boundary, even though the
  //    schema already rejects them — the next caller might skip the schema.
  const name = sanitizeLine(parsed.data.customerName)

  await sendEmail({
    to: parsed.data.customerEmail,
    from: 'noreply@yourdomain.com',
    subject: `Welcome, ${name}!`,
    html: renderWelcomeTemplate({ ...parsed.data, customerName: name }), // template escapes HTML
  })

  return NextResponse.json({ sent: true })
}
```

The caller sends the secret on every internal call:

```typescript
await fetch(`${process.env.INTERNAL_BASE_URL}/api/send-welcome-email`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-internal-secret': process.env.INTERNAL_API_SECRET!,
  },
  body: JSON.stringify({ customerEmail, customerName, courseLink }),
})
```

### Webhook endpoint — verify the provider's signature on the RAW body

```typescript
// app/api/stripe-webhook/route.ts
import Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  // Signature verification needs the raw, unparsed body.
  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    // Same codebase → direct call, no second HTTP endpoint to secure.
    await sendWelcomeEmailFor(event.data.object)
  }

  return NextResponse.json({ received: true })
}
```

### User-facing endpoint — identity from the token, never the body

```typescript
// app/api/update-preferences/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyUser } from '@/lib/auth'

const preferencesSchema = z.object({ marketing: z.boolean() })
// Note: NO userId/email in the schema — identity is not client input.

export async function POST(request: NextRequest) {
  const user = await verifyUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = preferencesSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

  await db.profiles.update({
    where: { id: user.id }, // from the verified token — the only source of truth
    data: { marketing: parsed.data.marketing },
  })

  return NextResponse.json({ success: true })
}
```

---

## Supabase Edge Functions (Vite/SPA projects)

Edge functions verify a Supabase JWT by default (`verify_jwt = true` in
`supabase/config.toml`) — keep that on for user-facing functions and you get
Pattern 1 for free; read the user with:

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  // user.id is verified — never read userId from the body.
  // ...
})
```

For webhook-receiving functions you must set `verify_jwt = false` (Stripe
can't send a Supabase JWT) — that makes the provider-signature check
**mandatory**, exactly as in the Next.js example. For internal
service-to-service functions, use the shared-secret pattern; the Web Crypto
equivalent of the constant-time check:

```typescript
async function verifyInternalSecret(provided: string | null): Promise<boolean> {
  const expected = Deno.env.get('INTERNAL_API_SECRET')
  if (!expected || expected.length < 32) return false // fail closed
  if (!provided) return false
  const enc = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ])
  const av = new Uint8Array(a), bv = new Uint8Array(b)
  let diff = 0
  for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i]
  return diff === 0
}
```

If the browser writes to tables directly via `supabase-js`, your "endpoint
auth" is Row Level Security: RLS enabled on every table, policies keyed on
`auth.uid()`, and no service-role key anywhere near client code.

---

## Auditing an existing codebase

```bash
# 1. Inventory every route handler
grep -rn "export async function POST\|export async function GET\|export default async function handler\|app\.post\|router\.post\|Deno\.serve" \
  --include="*.ts" --include="*.tsx" . | grep -v node_modules

# 2. Which handlers never reference an auth primitive? (candidates to inspect)
grep -rLE "verifyUser|verifyAdmin|verifyInternalSecret|getUser\(|auth\.uid\(\)|constructEvent|Authorization" \
  app/api supabase/functions 2>/dev/null

# 3. Body-supplied identity (each hit is a likely impersonation bug)
grep -rn "body\.userId\|body\.email\|body\.role\|req\.body\.userId\|req\.body\.email" \
  --include="*.ts" . | grep -v node_modules

# 4. Raw email-header construction (CRLF injection candidates)
grep -rn "From:.*\${\|Subject:.*\${\|Reply-To:.*\${" --include="*.ts" . | grep -v node_modules
```

Then list every endpoint called *by your own backend* (webhook → internal,
cron → internal) and verify each has its own auth. "Only we call it" stops
being true the moment the URL appears in a network tab or a log line.

## Checklist

- [ ] Every endpoint that writes, emails, or triggers a side effect has an explicit auth check as its **first** action — no exceptions for "internal"
- [ ] Same-codebase "internal endpoints" replaced with direct function calls where possible
- [ ] Service-to-service calls use a ≥32-char random shared secret, digest-based constant-time comparison, **failing closed** when the env var is missing
- [ ] Webhooks verify the provider's signature on the raw body before touching the payload
- [ ] `userId` / `email` / `role` always derived from a verified session or token — never from body or query string
- [ ] Admin actions re-checked server-side against the database, not just a client-side route guard
- [ ] Email-bound values: schema rejects `\r\n` AND the send boundary strips them (`sanitizeLine`)
- [ ] Outbound links in emails pinned to your own domain in the schema
- [ ] Service-role keys server-only (no `NEXT_PUBLIC_`/`VITE_` prefix); required secrets validated at boot
- [ ] Rate limiting on every public endpoint (see `FORM_VALIDATION_SECURITY.md`)
- [ ] Error responses never leak stack traces or internal details
- [ ] Every route found by the audit greps has a written-down answer to "who's allowed to call this?"

## Prompt your AI assistant

```
Audit this repository for unauthenticated or under-authenticated API endpoints.

For every API route handler (Express routes, Next.js API routes/route handlers,
Vercel serverless functions, Supabase Edge Functions, or equivalent), check:

1. Does it require a verified session, JWT, provider signature, or shared
   secret before doing anything state-changing (write, email send, external
   API call)? Flag any handler whose first side effect precedes its auth check.

2. Does it derive user identity (userId, email, role) from a verified
   session/token, or does it trust identity fields from the request body or
   query string? Flag the latter — that's an impersonation bug.

3. For endpoints only ever called by our own backend: could the call be a
   direct function invocation instead? If it must stay an endpoint, confirm a
   shared-secret check using a constant-time comparison that FAILS CLOSED
   (rejects) when the secret env var is missing. Flag any that fail open.

4. For webhook receivers: confirm the provider's signature is verified on the
   raw request body before the payload is used. Flag any that parse first or
   skip verification.

5. For code constructing email headers (From/To/Subject/Reply-To) by string
   interpolation: confirm every interpolated value is stripped of \r and \n
   at the point of use AND rejected by the input schema. Flag any missing
   either layer.

For each finding give: file and line, a one-line description of the exploit,
and a concrete fix using patterns already present in this codebase where
possible. Do not fix anything yet — just report.
```
