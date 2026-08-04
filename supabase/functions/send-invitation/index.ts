// Invitation email sender.
//
// Called by the sharing page right after an invitation link is minted, when
// the invitation names a recipient address. Sharing used to send nothing at
// all — the owner had to pass the link on by hand, and a recipient waiting on
// an email that would never arrive was the failure it caused.
//
// Security shape, in the order the checks run:
//   1. The gateway verifies the caller's JWT (verify_jwt = true).
//   2. The caller must hold the RAW invite token. Tokens are stored only as
//      SHA-256 hashes (migration 015), so re-hashing the provided token and
//      comparing against the stored hash proves this request comes from
//      whoever actually minted the link — the function can never be talked
//      into mailing a forged or guessed link.
//   3. The caller must still manage the property (inviter, property owner,
//      or owner/co-owner member) — a revoked co-owner's old token does not
//      keep working.
//   4. The recipient is ALWAYS the invitation's stored invited_email. The
//      request body cannot name an address, so this cannot be a mail cannon
//      aimed at arbitrary inboxes.
//   5. Rate limits: per-invitation resend cap, per-inviter daily ceiling —
//      counted from columns written only by this function (migration 041).
//
// Refuses with 503 while RESEND_API_KEY is unset: a user-facing "email sent"
// must never be a dry run that sent nothing.

import { createClient } from 'npm:@supabase/supabase-js@2.112.0';

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://ourhomefolder.com';
// Send from the address the digest has been warming up, not a brand-new one.
// The first live invitation (2026-08-04) was Resend-accepted from
// invitations@ and never reached a Gmail inbox — a cold sender address on a
// cold recipient is exactly what Gmail quarantines.
const FROM = Deno.env.get('INVITATION_FROM') ?? 'Our Home Folder <reminders@send.ourhomefolder.com>';
// CAN-SPAM requires a physical postal address on commercial mail; transactional
// mail is safer with it too. Same variable the digest uses.
const POSTAL_ADDRESS = Deno.env.get('POSTAL_ADDRESS') ?? '';

// A single invitation's email can be re-sent a couple of times (typos happen,
// spam folders happen), not forever.
const MAX_SENDS_PER_INVITATION = 3;
// Ceiling on invitation emails per inviter per rolling day. Generous for a
// household, far below anything that dents the shared Resend daily quota.
const MAX_INVITATIONS_EMAILED_PER_DAY = 10;

const ALLOWED_ORIGINS = [
  Deno.env.get('SITE_URL'),
  'https://ourhomefolder.com',
  'https://www.ourhomefolder.com',
  'http://localhost:3000',
  'http://localhost:3055'
].filter((value): value is string => Boolean(value));

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function json(body: Record<string, unknown>, status: number, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  co_owner: 'manage it alongside the owner',
  editor: 'add and edit its records',
  viewer: 'look through everything the owner chose to share',
  maintenance_guest: 'see the maintenance details relevant to their work',
  buyer_preview: 'see a buyer-safe summary',
  insurance_view: 'see an insurance-oriented summary'
};

const ROLE_LABELS: Record<string, string> = {
  co_owner: 'co-owner',
  editor: 'editor',
  viewer: 'viewer',
  maintenance_guest: 'maintenance guest',
  buyer_preview: 'buyer preview',
  insurance_view: 'insurance view'
};

function renderText(input: {
  inviterEmail: string;
  propertyName: string;
  role: string;
  acceptUrl: string;
  recipientEmail: string;
  expiresAt: string;
}): string {
  const what = ROLE_DESCRIPTIONS[input.role] ?? 'see it';
  return [
    `${input.inviterEmail} invited you to "${input.propertyName}" on Our Home Folder.`,
    '',
    `As a ${ROLE_LABELS[input.role] ?? input.role}, you can ${what}.`,
    '',
    `Accept the invitation: ${input.acceptUrl}`,
    '',
    `This link works only for ${input.recipientEmail} and expires ${input.expiresAt}.`,
    `You can also sign in at ${SITE_URL} with this address and accept from your dashboard.`,
    '',
    '---',
    "Didn't expect this? You can ignore it — nothing is shared until you accept.",
    POSTAL_ADDRESS
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function renderHtml(input: {
  inviterEmail: string;
  propertyName: string;
  role: string;
  acceptUrl: string;
  recipientEmail: string;
  expiresAt: string;
}): string {
  const what = ROLE_DESCRIPTIONS[input.role] ?? 'see it';
  const roleLabel = ROLE_LABELS[input.role] ?? input.role;

  return `<!doctype html><html><body style="margin:0;background:#EAE1CC;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#F6F0DF;border:1px solid rgba(22,48,42,.16);padding:28px">
    <div style="font:600 11px/1 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:#855A18">
      Our Home Folder
    </div>
    <h1 style="font:600 24px/1.15 Georgia,serif;color:#211C15;margin:10px 0 4px">You've been invited</h1>
    <p style="font:15px/1.6 Georgia,serif;color:#3A4A3E;margin:12px 0 0">
      <strong>${escapeHtml(input.inviterEmail)}</strong> invited you to
      &ldquo;${escapeHtml(input.propertyName)}&rdquo; on Our Home Folder.
    </p>
    <p style="font:15px/1.6 Georgia,serif;color:#3A4A3E;margin:12px 0 0">
      As a <strong>${escapeHtml(roleLabel)}</strong>, you can ${escapeHtml(what)}.
    </p>

    <p style="margin:28px 0 0">
      <a href="${input.acceptUrl}"
         style="display:inline-block;background:#C8923F;color:#211C15;text-decoration:none;
                padding:11px 18px;font:700 14px/1 Georgia,serif;border-radius:2px">
        Accept the invitation
      </a>
    </p>

    <p style="font:13px/1.6 Georgia,serif;color:#6A5E4D;margin:20px 0 0">
      This link works only for ${escapeHtml(input.recipientEmail)} and expires ${escapeHtml(input.expiresAt)}.
      You can also sign in at <a href="${SITE_URL}" style="color:#855A18">${escapeHtml(SITE_URL.replace(/^https?:\/\//, ''))}</a>
      with this address and accept from your dashboard.
    </p>

    <hr style="border:0;border-top:1px solid rgba(22,48,42,.16);margin:28px 0 12px">
    <p style="font:12px/1.6 ui-monospace,monospace;color:#6A5E4D;margin:0">
      Didn't expect this? You can ignore it — nothing is shared until you accept.
      ${POSTAL_ADDRESS ? `<br>${escapeHtml(POSTAL_ADDRESS)}` : ''}
    </p>
  </div></body></html>`;
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, cors);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Send-invitation function is not configured.' }, 500, cors);
  }

  if (!resendKey) {
    // A "sent" that sent nothing is exactly the lie this app keeps finding in
    // itself. Refuse loudly; the client falls back to copy-the-link wording.
    return json({ error: 'Invitation email is not enabled yet.' }, 503, cors);
  }

  let body: { invitation_id?: unknown; invite_token?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Send a JSON body.' }, 400, cors);
  }

  const invitationId = typeof body.invitation_id === 'string' ? body.invitation_id : '';
  const inviteToken = typeof body.invite_token === 'string' ? body.invite_token : '';

  if (!/^[0-9a-f-]{36}$/i.test(invitationId) || !/^[0-9a-f]{64}$/i.test(inviteToken)) {
    return json({ error: 'Invalid invitation reference.' }, 400, cors);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: request.headers.get('Authorization') || '' } }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Sign in before sending invitations.' }, 401, cors);
  }
  const caller = userData.user;

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: invitation, error: invitationError } = await serviceClient
    .from('property_invitations')
    .select('id, property_id, inviter_user_id, invited_email, role, token_hash, expires_at, accepted_at, revoked_at, deleted_at, email_send_count')
    .eq('id', invitationId)
    .maybeSingle();

  if (invitationError) {
    console.error('send-invitation: invitation lookup failed', { code: invitationError.code });
    return json({ error: 'Could not load the invitation.' }, 500, cors);
  }

  if (
    !invitation ||
    invitation.deleted_at ||
    invitation.revoked_at ||
    invitation.accepted_at ||
    new Date(invitation.expires_at).getTime() < Date.now()
  ) {
    return json({ error: 'This invitation is no longer open, so no email was sent.' }, 409, cors);
  }

  if (!invitation.invited_email) {
    return json({ error: 'This invitation has no recipient email — copy the link instead.' }, 400, cors);
  }

  // Proof of possession: only whoever holds the real minted token may cause
  // mail to be sent about it.
  if ((await sha256Hex(inviteToken)) !== invitation.token_hash) {
    return json({ error: 'Invalid invitation reference.' }, 403, cors);
  }

  // The caller must still manage this property right now.
  let authorized = invitation.inviter_user_id === caller.id;
  if (authorized) {
    // The inviter's own management role may have been revoked since minting.
    const { data: property } = await serviceClient
      .from('properties')
      .select('owner_user_id, deleted_at')
      .eq('id', invitation.property_id)
      .maybeSingle();
    if (!property || property.deleted_at) {
      return json({ error: 'This home no longer exists.' }, 409, cors);
    }
    if (property.owner_user_id !== caller.id) {
      const { data: membership } = await serviceClient
        .from('property_members')
        .select('role')
        .eq('property_id', invitation.property_id)
        .eq('user_id', caller.id)
        .is('deleted_at', null)
        .in('role', ['owner', 'co_owner'])
        .maybeSingle();
      authorized = Boolean(membership);
    }
  } else {
    const { data: property } = await serviceClient
      .from('properties')
      .select('owner_user_id, deleted_at')
      .eq('id', invitation.property_id)
      .maybeSingle();
    if (!property || property.deleted_at) {
      return json({ error: 'This home no longer exists.' }, 409, cors);
    }
    authorized = property.owner_user_id === caller.id;
    if (!authorized) {
      const { data: membership } = await serviceClient
        .from('property_members')
        .select('role')
        .eq('property_id', invitation.property_id)
        .eq('user_id', caller.id)
        .is('deleted_at', null)
        .in('role', ['owner', 'co_owner'])
        .maybeSingle();
      authorized = Boolean(membership);
    }
  }

  if (!authorized) {
    return json({ error: 'Only owners and co-owners can send invitation emails.' }, 403, cors);
  }

  // Rate limits.
  if ((invitation.email_send_count ?? 0) >= MAX_SENDS_PER_INVITATION) {
    return json(
      { error: 'This invitation has been emailed several times already. Copy the link instead, or create a new invitation.' },
      429,
      cors
    );
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: sentToday, error: rateError } = await serviceClient
    .from('property_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('inviter_user_id', caller.id)
    .gte('email_sent_at', dayAgo);

  if (rateError) {
    console.error('send-invitation: rate query failed', { code: rateError.code });
    return json({ error: 'Could not send the email. Copy the link instead.' }, 500, cors);
  }

  if ((sentToday ?? 0) >= MAX_INVITATIONS_EMAILED_PER_DAY) {
    return json({ error: 'Daily invitation email limit reached. Copy the link instead.' }, 429, cors);
  }

  const { data: property } = await serviceClient
    .from('properties')
    .select('nickname')
    .eq('id', invitation.property_id)
    .maybeSingle();

  const propertyName = property?.nickname || 'a home record';
  const acceptUrl = `${SITE_URL}/accept-invite?token=${encodeURIComponent(inviteToken)}`;
  const expiresAt = new Date(invitation.expires_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });

  const emailInput = {
    inviterEmail: caller.email || 'Someone',
    propertyName,
    role: invitation.role,
    acceptUrl,
    recipientEmail: invitation.invited_email,
    expiresAt
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM,
      to: invitation.invited_email,
      subject: `${emailInput.inviterEmail} shared "${propertyName}" with you on Our Home Folder`,
      html: renderHtml(emailInput),
      text: renderText(emailInput)
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('send-invitation: resend refused', { status: response.status, detail: detail.slice(0, 200) });
    // Durable record of the refusal, queryable from SQL — function logs rotate.
    await serviceClient.rpc('log_audit_event', {
      p_event_type: 'invitation.email_failed',
      p_property_id: invitation.property_id,
      p_payload: { invitation_id: invitation.id, status: response.status, detail: detail.slice(0, 300) },
      p_severity: 'alert',
      p_actor: caller.id
    });
    return json({ error: 'The email could not be sent. Copy the link and share it yourself.' }, 502, cors);
  }

  // Resend's message id is the handle for tracing delivery (dashboard,
  // webhooks, support). Without it, "Resend accepted it" is where the
  // trail ends — which is exactly where the first live send got stuck.
  let resendId = '';
  try {
    const body = await response.json();
    resendId = typeof body?.id === 'string' ? body.id : '';
  } catch {
    /* accepted but unparseable — the audit row below still records the send */
  }

  await serviceClient.rpc('log_audit_event', {
    p_event_type: 'invitation.email_sent',
    p_property_id: invitation.property_id,
    p_payload: { invitation_id: invitation.id, to: invitation.invited_email, resend_id: resendId, from: FROM },
    p_severity: 'info',
    p_actor: caller.id
  });

  const { error: bookkeepingError } = await serviceClient
    .from('property_invitations')
    .update({
      email_sent_at: new Date().toISOString(),
      email_send_count: (invitation.email_send_count ?? 0) + 1
    })
    .eq('id', invitation.id);

  if (bookkeepingError) {
    // The email went out; the count is a courtesy. Log, never fail the send.
    console.error('send-invitation: bookkeeping failed', { code: bookkeepingError.code });
  }

  return json({ sent: true, to: invitation.invited_email, resend_id: resendId }, 200, cors);
});
