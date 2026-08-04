import { createClient } from '@supabase/supabase-js';

// Account deletion is irreversible, so the caller must have signed in recently
// rather than merely holding a long-lived refreshed session.
const REAUTH_WINDOW_MS = 30 * 60 * 1000;

// Browsers preflight this call because supabase-js sends Authorization and
// x-client-info. Origins are pinned — never '*' — so no other site can invoke
// account deletion with a user's ambient credentials.
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

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  const cors = corsHeaders(origin);

  // Preflight only — deliberately performs no work and touches no data.
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, cors);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Delete-account function is not configured.' }, 500, cors);
  }

  const authorization = request.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } }
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Sign in again before deleting your account.' }, 401, cors);
  }

  const user = userData.user;
  const userId = user.id;

  // Require a recent sign-in. A token lifted from an unattended or shared
  // device should not be enough to erase someone's home record.
  const lastSignInAt = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : NaN;
  if (!Number.isFinite(lastSignInAt) || Date.now() - lastSignInAt > REAUTH_WINDOW_MS) {
    return json(
      {
        error:
          'For your security, sign out and sign back in, then delete your account within 30 minutes.',
        code: 'reauthentication_required'
      },
      401,
      cors
    );
  }

  // One transaction: properties are transferred or closed, memberships are
  // released, and the profile is anonymised — all of it, or none of it.
  const { data: summary, error: dataError } = await serviceClient.rpc('delete_account_data', {
    target_user_id: userId
  });

  if (dataError) {
    console.error('delete-account: data erasure failed', {
      code: dataError.code,
      message: dataError.message
    });
    return json({ error: 'Could not delete your account. Please try again.' }, 500, cors);
  }

  // Only now is it safe to remove the login — everything it pointed at is gone.
  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('delete-account: auth deleteUser failed', {
      status: deleteError.status,
      message: deleteError.message
    });
    return json(
      {
        error:
          'Your home data was removed, but the login could not be deleted. Please contact support so we can finish.'
      },
      500,
      cors
    );
  }

  return json({ ok: true, ...(summary ?? {}) }, 200, cors);
});

function json(body: Record<string, unknown>, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cors
    }
  });
}
