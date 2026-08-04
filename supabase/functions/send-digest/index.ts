// Reminder digest sender.
//
// Invoked daily by pg_cron. The schedule is daily; who actually gets an email
// today is decided per user by users_due_for_digest(), so frequency is a
// preference (monthly by default, weekly optional) rather than a property of
// the cron expression.
//
// SAFE BEFORE ANY EMAIL PROVIDER EXISTS.
// With no RESEND_API_KEY set, this runs the whole pipeline and reports what it
// *would* have sent without contacting anyone. That makes it deployable and
// testable today, and turning it on later is one `supabase secrets set`.

import { createClient } from 'npm:@supabase/supabase-js@2.112.0';

type DigestItem = { title: string; days_out: number };
type DigestPayload = {
  home: string;
  item_count: number;
  reminders: Array<DigestItem & { due_date: string }>;
  visits: Array<DigestItem & { date: string; window: string | null }>;
  warranties: Array<{ name: string; days_out: number; expires_at: string }>;
  service: Array<DigestItem & { due_date: string }>;
};

type DueRow = {
  user_id: string;
  email: string;
  frequency: string;
  time_zone: string;
  period_key: string;
  payload: DigestPayload;
};

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://ourhomefolder.com';
const FROM = Deno.env.get('DIGEST_FROM') ?? 'Our Home Folder <reminders@send.ourhomefolder.com>';

// Everyone on a monthly cadence is due in the same local hour on the 1st, so
// the loop below is a burst, not a trickle. Resend's free tier throttles at a
// couple of requests a second; going faster earns a 429 per person, and each
// one used to cost that reader their whole month (see migration 039).
const SEND_INTERVAL_MS = 600;

// Ceiling per invocation, well under Resend's 100/day so the security digest
// and any transactional mail still fit. Whoever does not make the cut has no
// digest_log row, so they are simply still due in tomorrow's retry window —
// the overflow spreads itself instead of being dropped.
const DIGEST_BATCH_LIMIT = 80;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Constant-time compare. Both sides are hashed first so the comparison always
 * runs over 32 equal-length bytes — a plain `!==` on the raw strings returns
 * early at the first differing byte and leaks length and prefix.
 */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b))
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i += 1) diff |= va[i] ^ vb[i];
  return diff === 0;
}
// CAN-SPAM requires a physical postal address. Use a PO box or virtual mailbox,
// never a home address — this goes to every recipient.
const POSTAL_ADDRESS = Deno.env.get('POSTAL_ADDRESS') ?? '';

function dueLabel(days: number): string {
  if (days < -1) return `${Math.abs(days)} days overdue`;
  if (days === -1) return 'due yesterday';
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `due in ${days} days`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Plain text alongside HTML: an HTML-only email is a long-standing spam signal,
 * and plenty of people read mail as text.
 */
function renderText(payload: DigestPayload, unsubscribeUrl: string): string {
  const lines: string[] = [];
  lines.push('Coming up at home');
  lines.push('');

  if (payload.visits.length > 0) {
    lines.push('SCHEDULED VISITS');
    for (const visit of payload.visits) {
      lines.push(`  ${visit.title} — ${dueLabel(visit.days_out)}${visit.window ? ` (${visit.window})` : ''}`);
    }
    lines.push('');
  }

  if (payload.reminders.length > 0) {
    lines.push('REMINDERS');
    for (const item of payload.reminders) lines.push(`  ${item.title} — ${dueLabel(item.days_out)}`);
    lines.push('');
  }

  if (payload.service.length > 0) {
    lines.push('SERVICE DUE');
    for (const item of payload.service) lines.push(`  ${item.title} — ${dueLabel(item.days_out)}`);
    lines.push('');
  }

  if (payload.warranties.length > 0) {
    lines.push('WARRANTIES ENDING');
    for (const item of payload.warranties) {
      lines.push(`  ${item.name} — ends in ${item.days_out} days`);
    }
    lines.push('');
  }

  lines.push(`Open your home record: ${SITE_URL}/dashboard`);
  lines.push('');
  lines.push('---');
  lines.push('You are getting this because you asked Our Home Folder to remind you.');
  lines.push(`Change how often, or stop: ${unsubscribeUrl}`);
  if (POSTAL_ADDRESS) lines.push(POSTAL_ADDRESS);

  return lines.join('\n');
}

function renderHtml(payload: DigestPayload, unsubscribeUrl: string): string {
  const section = (heading: string, rows: string[]) =>
    rows.length === 0
      ? ''
      : `<h2 style="font:600 15px/1.3 Georgia,serif;color:#211C15;margin:24px 0 8px">${heading}</h2>
         <ul style="margin:0;padding-left:18px;color:#3A4A3E;font:15px/1.6 Georgia,serif">${rows.join('')}</ul>`;

  const li = (main: string, detail: string) =>
    `<li style="margin-bottom:6px">${escapeHtml(main)} — <span style="color:#6A5E4D">${escapeHtml(detail)}</span></li>`;

  return `<!doctype html><html><body style="margin:0;background:#EAE1CC;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#F6F0DF;border:1px solid rgba(22,48,42,.16);padding:28px">
    <div style="font:600 11px/1 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:#855A18">
      Our Home Folder
    </div>
    <h1 style="font:600 24px/1.15 Georgia,serif;color:#211C15;margin:10px 0 4px">Coming up at home</h1>
    <p style="font:15px/1.6 Georgia,serif;color:#6A5E4D;margin:0">
      A short list so nothing quietly becomes urgent.
    </p>

    ${section('Scheduled visits', payload.visits.map((v) =>
      li(v.title, `${dueLabel(v.days_out)}${v.window ? ` · ${v.window}` : ''}`)))}
    ${section('Reminders', payload.reminders.map((r) => li(r.title, dueLabel(r.days_out))))}
    ${section('Service due', payload.service.map((s) => li(s.title, dueLabel(s.days_out))))}
    ${section('Warranties ending', payload.warranties.map((w) =>
      li(w.name, `ends in ${w.days_out} days`)))}

    <p style="margin:28px 0 0">
      <a href="${SITE_URL}/dashboard"
         style="display:inline-block;background:#C8923F;color:#211C15;text-decoration:none;
                padding:11px 18px;font:700 14px/1 Georgia,serif;border-radius:2px">
        Open your home record
      </a>
    </p>

    <hr style="border:0;border-top:1px solid rgba(22,48,42,.16);margin:28px 0 12px">
    <p style="font:12px/1.6 ui-monospace,monospace;color:#6A5E4D;margin:0">
      You are getting this because you asked Our Home Folder to remind you.<br>
      <a href="${unsubscribeUrl}" style="color:#855A18">Change how often, or stop</a>.
      ${POSTAL_ADDRESS ? `<br>${escapeHtml(POSTAL_ADDRESS)}` : ''}
    </p>
  </div></body></html>`;
}

/** Stateless HMAC so an unsubscribe link needs no table and survives prefetch. */
async function signUserId(userId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userId));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret = Deno.env.get('DIGEST_CRON_SECRET');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const unsubSecret = Deno.env.get('UNSUBSCRIBE_SECRET');

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Function is not configured.' }, 500);
  }

  // The endpoint is public (cron cannot present a user JWT), so a shared secret
  // is the only thing standing between the internet and a send loop. Refuse
  // when it is unset: an absent secret must not mean "no check", or a rotation
  // that empties the variable silently opens the send loop to the internet.
  if (!cronSecret) {
    console.error('send-digest: DIGEST_CRON_SECRET is not configured; refusing to run');
    return json({ error: 'Not configured.' }, 503);
  }

  const provided = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!provided || !(await safeEqual(provided, cronSecret))) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const dryRun = !resendKey;

  // ?mode=security — the operator's daily security digest, not a customer one.
  //
  // Silence means healthy: nothing is sent unless security_digest_report()
  // returns a row, so a delivered email always means something needs a human.
  // Runs on the pg_cron + pg_net + Resend that already exist; no new service,
  // no usage billing, nothing to monitor the monitor with.
  if (new URL(request.url).searchParams.get('mode') === 'security') {
    const { data: findings, error: reportError } = await supabase.rpc('security_digest_report');
    if (reportError) {
      console.error('send-digest[security]: report failed', {
        code: reportError.code,
        message: reportError.message
      });
      return json({ error: 'Could not build the security report.' }, 500);
    }

    const rows = (findings ?? []) as Array<{ category: string; detail: string; occurred_at: string }>;
    if (rows.length === 0) {
      return json({ ok: true, mode: 'security', findings: 0, sent: false });
    }

    const to = Deno.env.get('SECURITY_ALERT_EMAIL') ?? 'contact@ourhomefolder.com';
    if (dryRun) {
      console.log(`send-digest[security][dry-run]: ${rows.length} finding(s) would be emailed to ${to}`);
      return json({ ok: true, mode: 'security', findings: rows.length, sent: false, dryRun: true });
    }

    const body = rows
      .map((r) => `<li style="margin-bottom:6px"><strong>${escapeHtml(r.category)}</strong> — ${escapeHtml(r.detail)} <span style="color:#6A5E4D">(${escapeHtml(r.occurred_at)})</span></li>`)
      .join('');

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: FROM,
          to,
          subject: `Our Home Folder — ${rows.length} thing(s) to look at`,
          html: `<!doctype html><html><body style="font:15px/1.6 Georgia,serif;color:#211C15">
            <h1 style="font:600 20px/1.2 Georgia,serif">Security digest</h1>
            <p>These came up in the last 24 hours. Nothing is sent when there is nothing to report.</p>
            <ul>${body}</ul></body></html>`,
          text: rows.map((r) => `${r.category}: ${r.detail} (${r.occurred_at})`).join('\n')
        })
      });

      if (!response.ok) {
        console.error('send-digest[security]: resend rejected', { status: response.status });
        return json({ error: 'Could not send the security digest.' }, 502);
      }
    } catch (sendError) {
      console.error('send-digest[security]: send failed', {
        message: sendError instanceof Error ? sendError.message : 'unknown'
      });
      return json({ error: 'Could not send the security digest.' }, 502);
    }

    return json({ ok: true, mode: 'security', findings: rows.length, sent: true });
  }

  const { data, error } = await supabase.rpc('users_due_for_digest', { send_hour: 8 });
  if (error) {
    console.error('send-digest: could not list due users', { code: error.code, message: error.message });
    return json({ error: 'Could not list due users.' }, 500);
  }

  // digest_log is UNIQUE on (user_id, kind, period_key), so a retry after a
  // failure cannot INSERT — it has to overwrite the 'failed' row. Getting this
  // wrong is worse than the bug it fixes: the mail goes out, the write is
  // rejected, the guard still sees only 'failed', and the reader is mailed
  // again every day of the retry window.
  const logDigest = async (entry: Record<string, unknown>) => {
    const { error: logError } = await supabase
      .from('digest_log')
      .upsert(entry, { onConflict: 'user_id,kind,period_key' });
    if (logError) {
      // Loud, because a lost write here is what turns one send into three.
      console.error('send-digest: could not record digest_log', {
        code: logError.code,
        status: entry.status
      });
    }
  };

  const allDue = (data ?? []) as DueRow[];
  const due = allDue.slice(0, DIGEST_BATCH_LIMIT);
  const deferred = allDue.length - due.length;
  if (deferred > 0) {
    // Not a silent truncation: the deferred users keep no digest_log row, so
    // the next day in the retry window picks them up.
    console.log('send-digest: deferring to tomorrow', { deferred, limit: DIGEST_BATCH_LIMIT });
  }

  let sent = 0;
  let skippedEmpty = 0;
  let failed = 0;
  let attempted = 0;

  for (const row of due) {
    // Never send an empty digest. It is the single biggest driver of
    // unsubscribes, and it trains people to ignore the ones that matter.
    if (!row.payload || row.payload.item_count === 0) {
      skippedEmpty += 1;
      await logDigest({
        user_id: row.user_id,
        kind: 'digest',
        period_key: row.period_key,
        item_count: 0,
        status: 'skipped',
        detail: 'nothing due'
      });
      continue;
    }

    const token = unsubSecret ? await signUserId(row.user_id, unsubSecret) : '';
    const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?u=${row.user_id}&t=${token}`;

    if (dryRun) {
      sent += 1;
      console.log(`send-digest[dry-run]: would email ${row.payload.item_count} item(s)`);
      continue;
    }

    // Pace the burst. Only between real sends — skips and dry runs cost
    // Resend nothing, so making them wait would just stretch the run.
    if (attempted > 0) {
      await sleep(SEND_INTERVAL_MS);
    }
    attempted += 1;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: FROM,
          to: [row.email],
          // No PII in the subject: it shows on lock screens and in previews.
          subject: `Your home: ${row.payload.item_count} thing${row.payload.item_count === 1 ? '' : 's'} coming up`,
          html: renderHtml(row.payload, unsubscribeUrl),
          text: renderText(row.payload, unsubscribeUrl),
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Resend responded ${response.status}`);
      }

      sent += 1;
      await logDigest({
        user_id: row.user_id,
        kind: 'digest',
        period_key: row.period_key,
        item_count: row.payload.item_count,
        status: 'sent'
      });
      await supabase
        .from('digest_preferences')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('user_id', row.user_id);
    } catch (sendError) {
      failed += 1;
      console.error('send-digest: send failed', {
        message: sendError instanceof Error ? sendError.message : 'unknown'
      });
      await logDigest({
        user_id: row.user_id,
        kind: 'digest',
        period_key: row.period_key,
        item_count: row.payload.item_count,
        status: 'failed',
        detail: sendError instanceof Error ? sendError.message : 'unknown'
      });
    }
  }

  return json({ ok: true, dryRun, considered: due.length, sent, skippedEmpty, failed, deferred });
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
