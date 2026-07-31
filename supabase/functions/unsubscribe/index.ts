// Unsubscribe / change frequency, without requiring the recipient to sign in.
//
// The naive version puts a raw user id in the URL. That is an enumeration
// vulnerability: anyone can unsubscribe anyone, and a 200 confirms the account
// exists. Instead the link carries an HMAC of the user id, verified here.
//
// Stateless on purpose. A one-time token in a table breaks on re-clicks, and
// worse, mail clients prefetch links — Gmail would silently unsubscribe people
// who never clicked. A derived token is idempotent, so a prefetch is harmless.
//
// GET renders a confirm page (so a link scanner cannot unsubscribe anyone);
// POST acts immediately, which is what RFC 8058 one-click requires.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://ourhomefolder.com';

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

/** Constant-time compare, so the endpoint is not a token oracle. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <meta name="robots" content="noindex"><title>${title}</title></head>
     <body style="margin:0;background:#EAE1CC;font:16px/1.6 Georgia,serif;color:#211C15">
       <div style="max-width:520px;margin:12vh auto;padding:32px;background:#F6F0DF;
                   border:1px solid rgba(22,48,42,.16)">
         <div style="font:600 11px/1 ui-monospace,monospace;letter-spacing:.16em;
                     text-transform:uppercase;color:#855A18">Our Home Folder</div>
         ${body}
       </div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const userId = url.searchParams.get('u') ?? '';
  const token = url.searchParams.get('t') ?? '';

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secret = Deno.env.get('UNSUBSCRIBE_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !secret) {
    return page('Unavailable', '<h1>Not available</h1><p>Reminder settings are not configured yet.</p>', 503);
  }

  // A bad link and an unknown user must be indistinguishable.
  const notFound = () =>
    page('Not found', '<h1>Link not recognised</h1><p>This link may have expired. You can change reminders in your account settings.</p>', 404);

  if (!userId || !token) return notFound();

  const expected = await signUserId(userId, secret);
  if (!safeEqual(token, expected)) return notFound();

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (request.method === 'POST') {
    const { error } = await supabase
      .from('digest_preferences')
      .update({ frequency: 'off' })
      .eq('user_id', userId);

    if (error) {
      console.error('unsubscribe: update failed', { code: error.code, message: error.message });
      return page('Sorry', '<h1>That did not work</h1><p>Please try again, or change reminders in your account settings.</p>', 500);
    }

    return page(
      'Unsubscribed',
      `<h1 style="font-size:24px;margin:10px 0">Reminders stopped</h1>
       <p style="color:#6A5E4D">You will not get any more reminder emails. Your home record is untouched.</p>
       <p style="margin-top:24px"><a href="${SITE_URL}/settings" style="color:#855A18">Turn them back on</a></p>`
    );
  }

  // GET: confirm rather than act, so a mail client prefetching the link cannot
  // unsubscribe someone who never clicked it.
  return page(
    'Stop reminder emails?',
    `<h1 style="font-size:24px;margin:10px 0">Stop reminder emails?</h1>
     <p style="color:#6A5E4D">You will keep your home record — this only stops the emails.</p>
     <form method="POST" style="margin-top:24px">
       <button type="submit"
         style="background:#C8923F;color:#211C15;border:1px solid #C8923F;padding:11px 18px;
                font:700 14px/1 Georgia,serif;border-radius:2px;cursor:pointer">
         Yes, stop them
       </button>
     </form>
     <p style="margin-top:20px;font-size:14px">
       <a href="${SITE_URL}/settings" style="color:#855A18">Or send them less often instead</a>
     </p>`
  );
});
