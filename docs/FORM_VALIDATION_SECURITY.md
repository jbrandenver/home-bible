# Form Validation & Security Guide

A defence-in-depth template for handling user-submitted forms in React, Next.js,
Vite, and Supabase projects. Every layer assumes the layers in front of it have
failed.

## The layers

1. **Client-side validation (Zod)** — instant feedback, good UX. Provides zero
   security (anyone can bypass it with `curl`).
2. **Spam defences** — honeypot field, minimum-fill-time trap, rate limiting.
   CORS does **not** stop bots; they submit server-to-server and ignore it.
3. **Server-side validation (Zod, same schemas)** — the real gate. Never trust
   the client.
4. **Sanitization** — strip HTML and control characters before storing or
   forwarding input. The canonical XSS defence is still *escaping on output*
   (React does this automatically); sanitizing on input is defence-in-depth,
   and control-char stripping prevents email-header injection.
5. **CORS** — only needed when a *different* origin must call your API.
   Same-origin forms need no CORS headers at all.

## Dependencies

```bash
npm install zod xss
```

Both are mainstream, audited packages. No other dependencies are required —
rate limiting below is dependency-free.

---

## 1. Validation schemas — `src/lib/validation.ts`

Share one file between client and server so the rules can never drift apart.

```typescript
import { z } from 'zod'

// ===========================================
// FIELD PRIMITIVES — compose these into form schemas
// ===========================================

// \p{L} = letters from any language, \p{M} = combining accents.
// Accepts José, Müller, O'Brien, 李明. ASCII-only regexes like /^[a-zA-Z\s]+$/
// reject real customers' names — don't use them.
export const nameField = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[\p{L}\p{M}\s\-'.]+$/u, 'Name contains unsupported characters')

export const emailField = z
  .string()
  .trim()
  .email('Please enter a valid email address')
  .max(254, 'Email must be less than 254 characters')
  .toLowerCase()

// Lenient international check: optional +, 7–15 digits (E.164 bounds).
// Swap in a region-specific validator or libphonenumber-js if you need
// strict correctness for one country.
export const phoneField = z
  .string()
  .trim()
  .max(20, 'Phone number must be less than 20 characters')
  .refine(
    (val) => /^\+?[\d\s().-]{7,20}$/.test(val) &&
      val.replace(/\D/g, '').length >= 7 &&
      val.replace(/\D/g, '').length <= 15,
    'Please enter a valid phone number'
  )

export const messageField = z
  .string()
  .trim()
  .min(10, 'Message must be at least 10 characters')
  .max(2000, 'Message must be less than 2000 characters')

// Optional variant of any field: valid value, empty string, or absent.
export const optional = <T extends z.ZodTypeAny>(schema: T) =>
  schema.optional().or(z.literal(''))

// ===========================================
// CONTACT / ENQUIRY FORM
// ===========================================
export const enquiryFormSchema = z.object({
  name: nameField,
  email: emailField,
  phone: optional(phoneField),
  message: messageField,
  agreedToTerms: z
    .boolean()
    .refine((val) => val === true, 'You must agree to the terms and privacy policy'),

  // Spam defences — see section 3. The honeypot must be EMPTY; startedAt is
  // set when the form mounts.
  website: z.literal('').optional(),        // honeypot — humans never fill it
  startedAt: z.number().int().positive(),   // epoch ms when form was rendered
})

export type EnquiryFormData = z.infer<typeof enquiryFormSchema>

// ===========================================
// NEWSLETTER
// ===========================================
export const newsletterSchema = z.object({
  email: emailField,
  website: z.literal('').optional(),
  startedAt: z.number().int().positive(),
})

export type NewsletterData = z.infer<typeof newsletterSchema>

// ===========================================
// PATTERNS — copy as needed
// ===========================================

// Dropdowns: never accept free text where you expect a fixed set.
export const subjectField = z.enum(['general', 'support', 'sales'], {
  message: 'Please choose a subject',
})

// Multi-select with at least one choice:
export const topicsField = z.array(z.string().max(100)).min(1, 'Select at least one topic')

// Bounded numbers (scores, quantities):
export const scoreField = z.number().int().min(0).max(100)

// URLs — require a protocol and restrict to http(s):
export const urlField = z
  .string()
  .url('Please enter a valid URL')
  .refine((u) => /^https?:\/\//.test(u), 'URL must start with http:// or https://')

// ===========================================
// ERROR HELPERS
// ===========================================
export const getFirstError = (error: z.ZodError): string =>
  error.issues[0]?.message ?? 'Validation failed'

export const getFieldErrors = (error: z.ZodError): Record<string, string> => {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (!errors[path]) errors[path] = issue.message
  }
  return errors
}
```

---

## 2. Sanitization — `src/lib/sanitize.ts`

```typescript
import xss, { IFilterXSSOptions } from 'xss'

const xssOptions: IFilterXSSOptions = {
  whiteList: {},               // allow no HTML tags at all
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
}

// Strips ASCII control characters, including \r and \n. CRITICAL when a value
// is ever interpolated into email headers (From, Reply-To, Subject) — a name
// containing "\r\nBcc: victim@..." is an email-header-injection attack.
// (\s in a validation regex matches newlines, so validation alone won't stop this.)
export const stripControlChars = (input: string): string =>
  input.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()

export const sanitize = (input: string): string => {
  if (!input || typeof input !== 'string') return ''
  return xss(input.trim(), xssOptions)
}

// For single-line values that may reach email headers or logs.
export const sanitizeLine = (input: string): string =>
  stripControlChars(sanitize(input))

export const sanitizeEmail = (email: string): string => {
  if (!email || typeof email !== 'string') return ''
  return stripControlChars(email).toLowerCase()
}

export const sanitizePhone = (phone: string): string => {
  if (!phone || typeof phone !== 'string') return ''
  return phone.replace(/[^\d\s+().-]/g, '').trim()
}

// Multi-line text (messages, comments): strip HTML but keep newlines.
export const sanitizeText = (input: string): string =>
  sanitize(input).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
```

**Philosophy note:** stripping HTML on input is pragmatic when the value will be
emailed or displayed by systems you don't control. When you render it yourself,
the *real* protection is output escaping — React/JSX escapes by default; never
undo that with `dangerouslySetInnerHTML` on user input.

---

## 3. Spam defences — `src/lib/spam.ts` (server-side)

A public form with no spam defences **will** be found by bots within days.
Three cheap, dependency-free layers:

```typescript
// ---- 1. Honeypot -------------------------------------------------------
// Render a field named "website" hidden with CSS (not type="hidden" — some
// bots skip those). Humans leave it empty; bots fill it. On the server,
// a non-empty honeypot means: return a FAKE success (don't teach the bot).

// ---- 2. Time trap ------------------------------------------------------
// The form records Date.now() on mount and submits it as startedAt.
// Humans take more than 3 seconds; bots submit instantly. Spoofable, but
// it filters the dumb majority for free.
export const isTooFast = (startedAt: number, minMs = 3000): boolean =>
  Date.now() - startedAt < minMs

// ---- 3. Rate limiting --------------------------------------------------
// In-memory sliding window, per key (use the client IP). Caveats:
//  - Serverless: each instance/cold-start has its own map. Still blunts
//    bursts; for hard guarantees across instances use Upstash Ratelimit
//    or a database-backed counter.
//  - Long-running servers (Vite SSR, Node): works as-is.
const hits = new Map<string, number[]>()

export function rateLimit(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now()
  if (hits.size > 10_000) hits.clear() // crude memory bound
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) return false
  recent.push(now)
  hits.set(key, recent)
  return true
}

export const clientIp = (headers: Headers): string =>
  headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  headers.get('x-real-ip') ??
  'unknown'
```

If a form still attracts abuse after these, add Cloudflare Turnstile — it's
free and far less hostile to users than reCAPTCHA.

---

## 4. React form component

```tsx
import { useRef, useState } from 'react'
import { enquiryFormSchema, getFieldErrors, type EnquiryFormData } from '@/lib/validation'

type Status = 'idle' | 'submitting' | 'success' | 'error'

export function EnquiryForm() {
  const startedAt = useRef(Date.now())
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', message: '', agreedToTerms: false, website: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Status>('idle')

  const validateField = (field: keyof EnquiryFormData, value: unknown) => {
    const fieldSchema = enquiryFormSchema.shape[field]
    const result = fieldSchema.safeParse(value)
    setErrors((prev) => {
      const next = { ...prev }
      if (result.success) delete next[field]
      else next[field] = result.error.issues[0]?.message ?? 'Invalid'
      return next
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    setFormData((prev) => ({ ...prev, [name]: newValue }))
    validateField(name as keyof EnquiryFormData, newValue)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('submitting')

    const payload = { ...formData, startedAt: startedAt.current }
    const result = enquiryFormSchema.safeParse(payload)
    if (!result.success) {
      setErrors(getFieldErrors(result.error))
      setStatus('idle')
      return
    }

    try {
      const response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        if (data.errors) setErrors(data.errors)
        setStatus('error')
        return
      }
      setFormData({ name: '', email: '', phone: '', message: '', agreedToTerms: false, website: '' })
      setErrors({})
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" autoComplete="name"
          value={formData.name} onChange={handleChange}
          aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} />
        {errors.name && <p id="name-error" role="alert">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email"
          value={formData.email} onChange={handleChange}
          aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} />
        {errors.email && <p id="email-error" role="alert">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="phone">Phone (optional)</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel"
          value={formData.phone} onChange={handleChange}
          aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'phone-error' : undefined} />
        {errors.phone && <p id="phone-error" role="alert">{errors.phone}</p>}
      </div>

      <div>
        <label htmlFor="message">Message</label>
        <textarea id="message" name="message"
          value={formData.message} onChange={handleChange}
          aria-invalid={!!errors.message} aria-describedby={errors.message ? 'message-error' : undefined} />
        {errors.message && <p id="message-error" role="alert">{errors.message}</p>}
      </div>

      {/* Honeypot: visually hidden, still in the DOM for bots to find. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off"
          value={formData.website} onChange={handleChange} />
      </div>

      <div>
        <label>
          <input type="checkbox" name="agreedToTerms"
            checked={formData.agreedToTerms} onChange={handleChange} />
          I agree to the terms and privacy policy
        </label>
        {errors.agreedToTerms && <p role="alert">{errors.agreedToTerms}</p>}
      </div>

      <button type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Sending…' : 'Send message'}
      </button>

      {status === 'success' && <p role="status">Thanks — we'll be in touch shortly.</p>}
      {status === 'error' && <p role="alert">Something went wrong. Please try again.</p>}
    </form>
  )
}
```

Improvements over the naive version: honeypot + time trap wired in, accessible
error announcements (`role="alert"`, `aria-invalid`, `aria-describedby`),
`autoComplete` hints, inline success/error states instead of `alert()`.

---

## 5. API route — Next.js App Router (`app/api/enquiry/route.ts`)

**Same-origin first:** if this form lives in the same Next.js app as the route,
you need **no CORS headers at all** — the browser's same-origin policy already
covers you, and adding permissive CORS only widens your attack surface. The
CORS section below is only for APIs that a *different* site must call.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { enquiryFormSchema, getFieldErrors } from '@/lib/validation'
import { sanitizeLine, sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize'
import { rateLimit, clientIp, isTooFast } from '@/lib/spam'

const MAX_BODY_BYTES = 10_000

export async function POST(request: NextRequest) {
  // 1. Rate limit by IP before doing any work.
  if (!rateLimit(clientIp(request.headers))) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again shortly.' },
      { status: 429 }
    )
  }

  // 2. Cap payload size before parsing.
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, error: 'Payload too large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  // 3. Validate — the schema also enforces the empty honeypot.
  const result = enquiryFormSchema.safeParse(body)
  if (!result.success) {
    const issues = result.error.issues
    // Honeypot tripped → pretend success so the bot learns nothing.
    if (issues.some((i) => i.path[0] === 'website')) {
      return NextResponse.json({ success: true, message: 'Enquiry submitted successfully' })
    }
    return NextResponse.json(
      { success: false, error: 'Validation failed', errors: getFieldErrors(result.error) },
      { status: 400 }
    )
  }

  // 4. Time trap — silently accept, silently drop.
  if (isTooFast(result.data.startedAt)) {
    return NextResponse.json({ success: true, message: 'Enquiry submitted successfully' })
  }

  // 5. Sanitize before storing/forwarding. sanitizeLine strips \r\n —
  //    mandatory for anything that could reach an email header.
  const formData = {
    name: sanitizeLine(result.data.name),
    email: sanitizeEmail(result.data.email),
    phone: sanitizePhone(result.data.phone ?? ''),
    message: sanitizeText(result.data.message),
  }

  try {
    // Process: send email, insert into DB, notify Slack, etc.
    // await sendEnquiryEmail(formData)

    return NextResponse.json({ success: true, message: 'Enquiry submitted successfully' })
  } catch (error) {
    console.error('Enquiry API error:', error) // log details server-side only
    return NextResponse.json(
      { success: false, error: 'Failed to submit enquiry. Please try again.' },
      { status: 500 }
    )
  }
}
```

### CORS — only when a different origin calls this API

```typescript
// Environment-driven so localhost never ships to production:
//   .env.local        ALLOWED_ORIGINS=http://localhost:3000
//   production env    ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean)

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return {}
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
}

// Apply corsHeaders(request.headers.get('origin')) to EVERY response —
// including OPTIONS. Never answer the preflight with '*' while restricting
// POST: the two must use the same whitelist.
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(request.headers.get('origin')),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
```

Do **not** add `Access-Control-Allow-Credentials: true` unless the cross-origin
caller genuinely needs to send cookies — for a public contact form it never
does, and reflected-origin + credentials is a classic misconfiguration.

---

## 6. API endpoint — Supabase Edge Function (Vite/SPA projects)

For projects without a Next.js server (Vite + Supabase), the same logic runs in
a Deno edge function. `supabase/functions/enquiry/index.ts`:

```typescript
import { z } from 'npm:zod@3'

// Inline or import the same schema/sanitize/spam logic as the frontend.
// (Copy the files into supabase/functions/_shared/ so functions can share them.)
import { enquiryFormSchema, getFieldErrors } from '../_shared/validation.ts'
import { sanitizeLine, sanitizeEmail, sanitizeText } from '../_shared/sanitize.ts'
import { rateLimit, isTooFast } from '../_shared/spam.ts'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean)

const corsHeaders = (origin: string | null): Record<string, string> =>
  origin && ALLOWED_ORIGINS.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const cors = corsHeaders(origin)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(ip)) return json({ success: false, error: 'Too many requests' }, 429)

  const raw = await req.text()
  if (raw.length > 10_000) return json({ success: false, error: 'Payload too large' }, 413)

  let body: unknown
  try { body = JSON.parse(raw) } catch {
    return json({ success: false, error: 'Invalid JSON' }, 400)
  }

  const result = enquiryFormSchema.safeParse(body)
  if (!result.success) {
    if (result.error.issues.some((i) => i.path[0] === 'website')) {
      return json({ success: true }) // honeypot: fake success
    }
    return json({ success: false, error: 'Validation failed', errors: getFieldErrors(result.error) }, 400)
  }
  if (isTooFast(result.data.startedAt)) return json({ success: true })

  const formData = {
    name: sanitizeLine(result.data.name),
    email: sanitizeEmail(result.data.email),
    message: sanitizeText(result.data.message),
  }

  try {
    // Insert via supabase-js with the service role key, send email, etc.
    return json({ success: true, message: 'Enquiry submitted successfully' })
  } catch (error) {
    console.error('Enquiry function error:', error)
    return json({ success: false, error: 'Failed to submit enquiry. Please try again.' }, 500)
  }
})
```

Notes for Supabase projects:
- If the table is written via `supabase-js` from the browser instead, RLS
  policies are your server-side validation — add CHECK constraints and a
  Postgres policy; client-side Zod is still only UX.
- Edge functions share code via a `_shared/` folder; the `xss` npm package
  works in Deno via `npm:xss`.

---

## 7. Security checklist

### Every form
- [ ] Zod schema shared verbatim between client and server
- [ ] Server re-validates — client validation is UX only
- [ ] Honeypot field + time trap wired in, tripped requests get fake success
- [ ] Rate limiting on the endpoint (per IP)
- [ ] Payload size cap before parsing
- [ ] Dropdowns/selects use `z.enum()`, never free strings
- [ ] `\r\n`/control chars stripped from anything that reaches email headers
- [ ] Errors are field-level and human; 500s never leak stack traces
- [ ] Submit button disabled while submitting; success/error states inline (no `alert()`)
- [ ] Error messages announced accessibly (`role="alert"`, `aria-invalid`)

### API
- [ ] Same-origin app → no CORS headers at all
- [ ] Cross-origin → whitelist from `ALLOWED_ORIGINS` env var, identical for POST and OPTIONS, `Vary: Origin` set
- [ ] No localhost origins in production env
- [ ] No `Access-Control-Allow-Credentials` unless cookies are genuinely required
- [ ] HTTPS in production
- [ ] Secrets (API keys, service-role keys) only in server env, never in client bundles

### Escalation path for persistent spam
1. Honeypot + time trap + rate limit (this guide — free, invisible)
2. Cloudflare Turnstile (free, low-friction)
3. Email/domain blocklists, manual review queue

## 8. Field validation reference

| Field | Rule |
|-------|------|
| Name | 2–100 chars, `\p{L}\p{M}` unicode letters + space/hyphen/apostrophe/period |
| Email | Zod `.email()`, max 254, lowercased |
| Phone | Optional `+`, 7–15 digits (E.164 bounds); use libphonenumber-js for strict per-country rules |
| Free text | Min/max length; sanitize with `xss` (empty whitelist) |
| Dropdown | `z.enum([...])` |
| Multi-select | `z.array(z.string().max(n)).min(1)` |
| Number | `z.number().int().min().max()` |
| URL | `z.string().url()` + require `https?://` |
| Consent | `z.boolean().refine(v => v === true)` |
| Honeypot | `z.literal('')` — non-empty means bot |
