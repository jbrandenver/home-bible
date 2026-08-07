-- 045: remember which Stripe customer a purchase belongs to.
--
-- The gap this closes: nothing linked an app account to a Stripe customer.
-- stripe-webhook read `session.customer_details.email` to work out WHO to
-- credit, then discarded `session.customer` — the id of the customer record
-- the money actually sits under.
--
-- Without that link the only way to reach someone's billing was Stripe's
-- no-code portal, which authenticates by email. That works right up until the
-- email someone pays with differs from the email they log in with — a work
-- card, a spouse's account, a personal address on a business subscription —
-- at which point the portal correctly reports "no payments on file" about a
-- different customer record, and the customer concludes their subscription is
-- missing. Observed for real: the founder account holds two live Stripe
-- customers, and the one carrying the $29 subscription is under neither the
-- app profile email nor the address he tried.
--
-- With the id stored, the app can mint a portal session for exactly the right
-- customer, server-side, from the caller's own entitlement row. No email
-- entry, and no way to land on someone else's billing.
--
-- Additive and deploy-safe: nothing reads this column until the billing-portal
-- function ships, and nothing writes it until the webhook is redeployed.
-- Nullable on purpose — rows predating this migration have no value, and a
-- one-time pack bought without a customer record legitimately never will.

alter table public.entitlements
  add column if not exists provider_customer_id text;

comment on column public.entitlements.provider_customer_id is
  'Stripe customer id (cus_...) from checkout.session.customer. Used to mint '
  'billing-portal sessions for the right customer without asking for an email.';

-- Resolving "which customer is this user" must not become a table scan on a
-- growing table, and the billing-portal function does exactly that lookup on
-- every click.
create index if not exists entitlements_user_customer_idx
  on public.entitlements (user_id, provider_customer_id)
  where provider_customer_id is not null;

-- No grant changes. `authenticated` already holds table-level SELECT on
-- entitlements and a new column inherits it; the column is not sensitive (a
-- customer id is not a credential and is useless without the secret key), and
-- RLS still restricts rows to their owner. Deliberately NOT following the
-- 031/033 column-revoke pattern here, because there is nothing to withhold.
