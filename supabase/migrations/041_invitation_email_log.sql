-- 041: bookkeeping for invitation emails.
--
-- The send-invitation Edge Function records every delivery here so that
-- (a) the sharing page can say "Emailed" instead of leaving the owner to
-- wonder, and (b) the function has something cheap to rate-limit on:
-- per-invitation resend cap and a per-inviter daily ceiling, both counted
-- from these columns rather than a new table.
--
-- Written only by the service role (the Edge Function). The table-level
-- SELECT grant that authenticated already holds covers reading them; no
-- new grants are needed and none are added.

alter table public.property_invitations
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_send_count integer not null default 0;

comment on column public.property_invitations.email_sent_at is
  'When the invitation email was last sent via the send-invitation Edge Function. Null = never emailed.';
comment on column public.property_invitations.email_send_count is
  'How many times the invitation email has been sent. The Edge Function refuses past its cap.';

-- The daily rate-limit query filters on inviter + last send time.
create index if not exists property_invitations_email_rate_idx
  on public.property_invitations (inviter_user_id, email_sent_at)
  where email_sent_at is not null;
