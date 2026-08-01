# Switching on reminders and payments

Everything for both is already built, deployed-ready and tested. Neither is
switched on, because each needs an account only you can open. This is the exact
sequence for when you are ready — nothing here requires code changes.

Both are designed to be **inert rather than broken** while unconfigured:
`send-digest` runs the whole pipeline and reports what it *would* have sent;
`stripe-webhook` refuses every request with a 503. So you can deploy them today
and switch them on whenever.

---

## A. Reminder emails

### What actually gets sent

Titles, dates and counts. Nothing else. The payload builder
(`public.build_user_digest`) deliberately excludes the address, appliance
brands/models/serials, contractor names and numbers, costs, and any note you
typed. Verified against real data: a test repair carrying a contractor name,
phone, a $450 cost and the text "gate code is 4417" produced a digest
containing none of them.

That is not fussiness. Email is unencrypted in transit, syncs to every device
the recipient owns, is indexed by their provider, and previews on a lock
screen. A list of someone's home maintenance is a burglary reconnaissance
document. If the email is forwarded or the inbox is breached, the blast radius
must be "this person has a home and owns a furnace".

### Why monthly is the default

The app's own dashboard digest already looks 14 days ahead for reminders, 30
for the next service date, and 60 for warranty expiry. That is a monthly
horizon. Home maintenance runs on a seasonal cadence — filters quarterly,
gutters twice a year, HVAC annually — so a weekly email about a gutter clean due
in six weeks is noise, and noise gets unsubscribed.

Monthly has one gap: something created on the 5th and due on the 10th would
never be emailed, because the next send is the 1st. Two things close it:

1. The monthly digest looks **35 days** ahead, not 30, so consecutive sends
   overlap rather than leaving a hole.
2. A **scheduled technician visit** is the one genuinely short-fuse item, so it
   gets its own next-day nudge regardless of digest frequency.

Users can choose weekly in Settings. Monthly is also far kinder on the free
tier: 100 users monthly is 100 emails/month against a 3,000/month allowance,
versus 400 weekly and a 100/day cap you would hit at exactly 100 users.

### Steps

**1. Resend account and domain** — free, no card.

- Sign up at resend.com, add the domain **`send.ourhomefolder.com`**.
  Use the subdomain, not the apex: it isolates sending reputation, so a future
  deliverability problem cannot damage the domain you use for real
  correspondence.
- Add the SPF, DKIM and MX records Resend shows you, on that subdomain.
- Add DMARC on the apex, starting permissive:
  `_dmarc.ourhomefolder.com  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@ourhomefolder.com;"`
  Read the reports for a month, then tighten to `p=quarantine`.
- Create an API key.

**2. A postal address for the footer.** CAN-SPAM requires one. **Do not use your
home address** — it goes to every recipient. A PO box or virtual mailbox is
~$10–20/month and is the only genuinely unavoidable cost in any of this.

**3. Secrets.**

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxx \
  UNSUBSCRIBE_SECRET="$(openssl rand -hex 32)" \
  DIGEST_CRON_SECRET="$(openssl rand -hex 32)" \
  SITE_URL=https://ourhomefolder.com \
  DIGEST_FROM='Our Home Folder <reminders@send.ourhomefolder.com>' \
  POSTAL_ADDRESS='JBran LLC, PO Box 000, Your City, ST 00000'
```

**4. Deploy.**

```bash
supabase functions deploy send-digest
supabase functions deploy unsubscribe
```

**5. Dry run before scheduling anything.** With the key set this sends for real,
so test on your own account first — set your own frequency to monthly, make sure
you have something due, and invoke it manually.

**6. Schedule it.** Runs daily; the function decides who is actually due, so
frequency stays a per-user preference.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<DIGEST_CRON_SECRET>', 'digest_cron_secret');

select cron.schedule('home-folder-digest', '0 * * * *', $$
  select net.http_post(
    url := 'https://gdntnlhnjyyzxcjuypuy.supabase.co/functions/v1/send-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'digest_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);
```

Hourly, not daily, because `users_due_for_digest` matches on the user's **local**
8am — an hourly tick is what lets one schedule serve every timezone.

**7. Housekeeping.** `cron.job_run_details` is not auto-cleaned and will slowly
eat a 500 MB database. Add a monthly purge:

```sql
select cron.schedule('purge-cron-history', '0 3 1 * *', $$
  delete from cron.job_run_details where end_time < now() - interval '30 days';
$$);
```

### Watch out for

- **Free Supabase projects pause after ~7 days of inactivity**, and a paused
  project means the digest silently stops. Whether cron activity alone prevents
  pausing is not documented. This is another reason to be on Pro before you rely
  on it.
- **Never send an empty digest.** The function already skips anyone with nothing
  due, and logs it as `skipped`. Do not "fix" that.
- Check `digest_log` after the first few runs: `status` of `failed` with a
  message is how a delivery problem surfaces.

---

## B. Payments

### The honest constraint, first

The Handover Pack is generated **in the browser** from data the user already
owns and can legitimately read. So the paywall is a client-side check backed by
an entitlements table — **not an enforced boundary**. A technical user could
read their own rows and render their own PDF.

That is a normal way to sell formatting and convenience, and the realistic
bypass rate for a homeowner at a closing is nil. But know it now rather than
discover it. If it ever matters, move generation into an Edge Function that
checks the entitlement with the service role and returns a signed URL — roughly
two days, and a clean upgrade you can make *after* someone has actually paid.

What *is* enforced: **nobody can grant themselves an entitlement.**
`public.entitlements` has a SELECT policy and no INSERT, UPDATE or DELETE policy
at all, and insert/update/delete are revoked from `anon` and `authenticated`.
Verified: a signed-in user attempting to insert one produced zero rows.

### Steps

**1. Stripe account**, test mode to begin with.

**2. Two Products with one-time Prices**, then a **Payment Link** for each. In
each link's settings, set metadata `product_key` to `handover_pack` or
`insurance_evidence_pack` — the webhook keys off that. Enable email collection
on the link; it is the fallback when the buyer id is missing.

**3. Secrets and deploy.**

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx STRIPE_WEBHOOK_SIGNING_SECRET=whsec_xxx
supabase functions deploy stripe-webhook
```

**4. Register the endpoint** in Stripe → Developers → Webhooks:
`https://gdntnlhnjyyzxcjuypuy.supabase.co/functions/v1/stripe-webhook`,
subscribed to `checkout.session.completed`, `charge.refunded`,
`charge.dispute.created`. Paste its signing secret into the secret above — note
this is **different** from the one `stripe listen` prints locally.

**5. Link buyers to their purchase.** Append the signed-in user's id:

```
https://buy.stripe.com/xxxx?client_reference_id=<user.id>&prefilled_email=<email>
```

It is a URL parameter, so it is buyer-controlled and Stripe silently drops
malformed values. The webhook therefore treats it as a hint, not authorisation:
it verifies the id resolves to a real profile, falls back to matching the email
Stripe collected, and if neither resolves writes to `unmatched_purchases` rather
than losing the sale. Check that table occasionally.

**6. Test before going live.**

```bash
supabase functions serve stripe-webhook --no-verify-jwt
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```

Card `4242 4242 4242 4242` succeeds; **`4000 0000 0000 0259`** succeeds then
raises a dispute — use it, and confirm the handler does not fall over.

The tests worth actually running:
- Replay the same event twice → exactly one entitlement row.
- Strip `client_reference_id` → money taken, row in `unmatched_purchases`, no crash.
- Bogus `Stripe-Signature` → 400, and **zero** database writes.
- From the browser with a real session, try to insert into `entitlements` → fails.

**7. Move to Supabase Pro ($25/month) the day you go live.** Free projects pause
when idle, and a paused project means someone pays and gets nothing. Stripe
retries for three days, which saves you only if you notice. Against $29–79
products that is one extra sale a month.

### The Portfolio plan (recurring subscription)

The landlord tier (migration 023, `product_key = portfolio_plan`) is a
**recurring** price, unlike the two one-time packs. Same webhook, three extra
moving parts:

**1. ~~Create one Product with a recurring monthly Price~~ — DONE 2026-08-01.**
Ruled at **$29/mo** flat. Product `prod_UzOpKwRqfodFxq`, price
`price_1TzQ1sJiLFGoCM3v3IqGZkN0`, Payment Link
`https://buy.stripe.com/7sY28s9L2dFM0G331b6Zy00` carrying metadata
`product_key = portfolio_plan`.

Worth knowing, because it is the whole reason the webhook can identify the
purchase: metadata set on a **Payment Link** is copied by Stripe onto every
Checkout Session the link creates, so it arrives as `session.metadata` in
`checkout.session.completed`. Metadata set on `subscription_data` would NOT —
that lands on the Subscription instead. Both are set here; the top-level one
is the one that matters.

Email collection is automatic in subscription mode (a Customer is always
created), so there is nothing to switch on for the webhook's email fallback.

**2. Subscribe the webhook to three more events** in addition to the ones in
step 4 above: `invoice.paid`, `customer.subscription.deleted`. (You can also
add `customer.subscription.updated`; the handler ignores what it doesn't
know.) The lifecycle: checkout stamps `provider_subscription_id` and an
`expires_at` at period end + 3 days grace; every `invoice.paid` rolls
`expires_at` forward; `customer.subscription.deleted` revokes. A missed
cancellation webhook therefore fails **safe** — access lapses at the end of
the last paid period instead of living forever.

**3. Expose the checkout to the app.** The portfolio page reads
`NEXT_PUBLIC_STRIPE_PORTFOLIO_PAYMENT_LINK` at build time; set it in the
host's env (Vercel/Cloudflare) to the Payment Link URL. Until it is set, the
portfolio features stay visible but ungated (deliberate: never gate users
behind a checkout that does not exist), and the upgrade card says "not yet
available".

Extra tests worth running for subscriptions:
- Complete a subscription checkout → entitlement row with
  `provider_subscription_id` set and `expires_at` ≈ one month + 3 days out.
- `stripe trigger invoice.paid` for that subscription → `expires_at` moves.
- Cancel the subscription in the Stripe dashboard → row flips to `revoked`.
- Let a test-clock subscription lapse without events → `has_entitlement`
  returns false after `expires_at` passes (no webhook needed).

### The pro binder (one-time, per report)

The professional channel (migration 025, `/pro` page) adds a **third Payment
Link**: one Product with a **one-time** Price — suggested **$15–25 per binder**,
matching the RecallChek per-report benchmark cited in
docs/THREAT_MITIGATION.md (T6) — with metadata `product_key` set to
`pro_binder` on the link, email collection enabled, exactly like the two packs
in step 2 above. Expose it to the app by setting
`NEXT_PUBLIC_STRIPE_PRO_BINDER_PAYMENT_LINK` in the host's env. Until it is
set, the pro page honestly says binders are free during early access — same
soft-gate stance as the Portfolio plan: never gate behind a checkout that does
not exist.

### Tax

Sell **US-only at first** and set a country restriction on the checkout. The EU
and UK have no de-minimis threshold for digital goods sold to consumers — the
VAT obligation attaches from the first sale. Staying domestic avoids the whole
surface.

The day you want international buyers, switch to a merchant-of-record (Paddle,
or Lemon Squeezy) which becomes the legal seller and handles it. That is a
checkout swap: the entitlements table and webhook shape stay identical.

**Get a CPA's view on whether your state taxes digital products before taking
the first dollar.** I deliberately did not research state tax rules — they vary,
change annually, and are exactly where a wrong answer costs real money.

### Refunds

Refund on request, immediately, and never fight a dispute on principle. Stripe
keeps the original processing fee on a refund, and a dispute costs $15 to
receive plus $15 to contest — so a disputed $29 sale is a net loss of around $44
**even when you win**. The economics are not close.

---

## C. Recall monitoring

**Free to run.** The CPSC Recall API (saferproducts.gov) is public, keyless and
free; the function makes at most ~30 outbound requests per daily run. No
account to open, no card, no per-call cost — the only prerequisite is applying
migration `024_recall_monitoring.sql`.

Like the others, the function is inert until configured: with no
`RECALL_CRON_SECRET` set it refuses every request with a 503.

**1. Secret and deploy.**

```bash
supabase secrets set RECALL_CRON_SECRET="$(openssl rand -hex 32)"
supabase functions deploy check-recalls
```

**2. Schedule it.** Daily is enough — recalls are published on a weekly-ish
cadence, and the function caps itself at ~30 brand queries per run.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<RECALL_CRON_SECRET>', 'recall_cron_secret');

select cron.schedule('home-folder-check-recalls', '0 6 * * *', $$
  select net.http_post(
    url := 'https://gdntnlhnjyyzxcjuypuy.supabase.co/functions/v1/check-recalls',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'recall_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
```

Daily at 06:00 UTC (unlike the digest there is no per-user local-time logic, so
one fixed tick is fine). The `purge-cron-history` job from §A already covers
this schedule's run history.

**3. Verify.** Invoke it once by hand and read the counts:

```bash
curl -s -X POST \
  -H "Authorization: Bearer $RECALL_CRON_SECRET" \
  https://gdntnlhnjyyzxcjuypuy.supabase.co/functions/v1/check-recalls
```

Expect `{"ok":true, ...}` with `assetsConsidered` / `brandsQueried` /
`matchesInserted`. Matches surface on the Warranties page as a "Safety
recalls" section; a dismissed match never returns to "open" (the insert is
`ON CONFLICT DO NOTHING`).

---

## D. Data-plate scanning

**Founder-approved paid API (the only one).** The `analyze-plate` Edge
Function turns a photo of an appliance label into brand / model / serial /
year via a single Claude Haiku vision call. Cost is roughly **$3–5 per 1,000
scans** at Haiku pricing, and caps are enforced server-side (in the
`plate_scans` table from migration `025_record_transfer_partners.sql`):
**30 lifetime scans free**, **1,000 with an active Portfolio plan** — the
Portfolio number is an abuse ceiling, not a metered product limit.

**Privacy stance (also stated in the function header): the photo is processed
in one stateless call and discarded.** It is never written to storage, never
logged, never retained, and never used to train a model. Only a usage row
(who, when, ok/failed) persists.

Like every other function, it is inert until configured: with no
`ANTHROPIC_API_KEY` set it refuses every request with a 503 and the app shows
"Scanning isn't enabled yet."

**1. Secret and deploy.**

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy analyze-plate
```

(Migration `025_record_transfer_partners.sql` must already be applied — it
creates `plate_scans`, which the function requires for cap enforcement.)

**2. Smoke test.** The function is JWT-gated (`verify_jwt = true`), so you
need a signed-in user's access token — grab one from the browser devtools
(`sb-<ref>-auth-token` local storage entry) or via the Supabase JS client.

```bash
# A tiny valid JPEG is enough to prove the pipeline end to end.
IMAGE_B64=$(base64 -i some-label-photo.jpg | tr -d '\n')

curl -s -X POST \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$IMAGE_B64\",\"media_type\":\"image/jpeg\"}" \
  https://gdntnlhnjyyzxcjuypuy.supabase.co/functions/v1/analyze-plate
```

Expect `{"brand":..., "model_number":..., "serial_number":...,
"manufacture_year":..., "confidence":"high|medium|low", "notes":...,
"scans_used":N, "scan_cap":30}`. Before the key is set, the same call returns
`503 {"error":"Not configured.","detail":"Data-plate scanning is not enabled
yet."}`; past the cap it returns a friendly 429.

**3. Verify the usage log.** Each call (ok or failed) writes one row:

```sql
select user_id, status, created_at from plate_scans order by created_at desc limit 10;
```

The seasonal maintenance plan that ships alongside this feature needs **no
activation at all** — it is a deterministic, $0 rules engine computed in the
browser from the home profile.
