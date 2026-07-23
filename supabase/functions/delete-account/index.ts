import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type PropertyRow = {
  id: string;
  household_id: string;
  owner_user_id: string;
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Delete-account function is not configured.' }, 500);
  }

  const authorization = request.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } }
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Sign in again before deleting your account.' }, 401);
  }

  const userId = userData.user.id;
  const now = new Date().toISOString();

  const { data: ownedProperties, error: ownedError } = await serviceClient
    .from('properties')
    .select('id, household_id, owner_user_id')
    .eq('owner_user_id', userId)
    .is('deleted_at', null);

  if (ownedError) {
    console.error('delete-account: failed to load owned properties', ownedError);
    return json({ error: 'Could not delete your account. Please try again.' }, 500);
  }

  for (const property of (ownedProperties ?? []) as PropertyRow[]) {
    const { data: successor } = await serviceClient
      .from('property_members')
      .select('user_id')
      .eq('property_id', property.id)
      .in('role', ['owner', 'co_owner'])
      .is('deleted_at', null)
      .neq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (successor?.user_id) {
      await serviceClient
        .from('properties')
        .update({ owner_user_id: successor.user_id })
        .eq('id', property.id);
    } else {
      await serviceClient
        .from('properties')
        .update({ deleted_at: now })
        .eq('id', property.id);
    }
  }

  await serviceClient
    .from('property_members')
    .update({ deleted_at: now })
    .eq('user_id', userId)
    .is('deleted_at', null);

  await serviceClient
    .from('household_members')
    .update({ deleted_at: now })
    .eq('user_id', userId)
    .is('deleted_at', null);

  await serviceClient
    .from('profiles')
    .update({
      email: null,
      full_name: 'Deleted account',
      avatar_url: null,
      deleted_at: now
    })
    .eq('id', userId);

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('delete-account: auth deleteUser failed', deleteError);
    return json({ error: 'Could not delete your account. Please try again.' }, 500);
  }

  return json({ ok: true });
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
