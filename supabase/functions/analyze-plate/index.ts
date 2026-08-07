// Appliance data-plate scanner: photo → brand / model / serial / year.
//
// PRIVACY STANCE: the photo is processed in one stateless vision call and then
// discarded. It is never written to storage, never logged, never retained by
// this function, and (per Anthropic's API terms) never used for training. The
// only thing persisted is a plate_scans usage row (who scanned, when, ok or
// failed) so the cap can be enforced server-side, next to the API key.
//
// AUTH: `verify_jwt = true` in config.toml validates the caller's JWT at the
// gateway, AND the handler independently verifies it via auth.getUser(). The
// belt-and-braces is deliberate: this function holds an Anthropic key, so it
// must not depend on a flag stored outside the code to stay authenticated.
//
// COST GOVERNANCE (docs/COST_GOVERNANCE.md): exactly ONE model call per scan,
// on the cheap tier (claude-haiku-4-5), capped at 1024 output tokens, no
// retries beyond SDK defaults, no loops. Caps: 30 lifetime scans free,
// 1000 with an active portfolio_plan entitlement.
//
// SAFE BEFORE THE KEY EXISTS: with no ANTHROPIC_API_KEY configured the
// function refuses every request with a 503 rather than half-working, exactly
// like stripe-webhook and send-digest. Turning it on later is one
// `supabase secrets set ANTHROPIC_API_KEY=...`.

import Anthropic from 'npm:@anthropic-ai/sdk@0.115.0';
import { createClient } from 'npm:@supabase/supabase-js@2.112.0';

const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// The client compresses to ~1568px JPEG before upload, which lands well under
// this. Base64 inflates bytes by 4/3, so ~1.5MB decoded ≈ 2,000,000 chars.
const MAX_BASE64_LENGTH = 2_000_000;

// Free tier: 30 scans, lifetime. Enough to document every appliance in a
// large home with retries to spare.
const FREE_SCAN_CAP = 30;

// Portfolio tier: 1000. This is an abuse ceiling, not a product limit — the
// pricing page promises "no AI credits, no metering", and at Haiku pricing
// 1000 scans cost a few dollars. The ceiling exists so a leaked session
// cannot run up an unbounded bill.
const PORTFOLIO_SCAN_CAP = 1000;

// The allowance counts scans that actually returned something. A photo the
// model could not read gave the person nothing, so charging them for it is
// simply wrong — and in a bulk walkthrough, bad lighting could otherwise eat a
// third of the free tier before a single appliance was recorded.
//
// Failed attempts still cost a real API call, so they are bounded separately:
// total attempts may reach this multiple of the allowance. That keeps a broken
// camera, or a retry loop, from running up an unbounded bill.
const ATTEMPT_CEILING_MULTIPLIER = 1.5;

const PLATE_SCHEMA = {
  type: 'object',
  properties: {
    brand: { type: ['string', 'null'] },
    model_number: { type: ['string', 'null'] },
    serial_number: { type: ['string', 'null'] },
    manufacture_year: { type: ['integer', 'null'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    notes: { type: ['string', 'null'] }
  },
  required: ['brand', 'model_number', 'serial_number', 'manufacture_year', 'confidence', 'notes'],
  additionalProperties: false
} as const;

const EXTRACTION_INSTRUCTIONS = [
  'This photo shows an appliance data plate (the manufacturer label carrying the model and serial numbers).',
  'Extract the fields exactly as printed on the label. Do not guess: if a field is not visible or not legible, return null for it.',
  'brand: the manufacturer name as printed.',
  'model_number: the model / model no. / M/N value, exactly as printed.',
  'serial_number: the serial / serial no. / S/N value, exactly as printed.',
  'manufacture_year: only when the plate states a manufacture date explicitly or the date code is unambiguous; otherwise null.',
  "confidence: 'high' only when brand and model number are both clearly legible; 'medium' when readable but partly obscured or blurry; 'low' when mostly guesswork.",
  'notes: one short sentence about anything the user should double-check (glare, cropped edge, ambiguous characters), or null.'
].join('\n');

// Browsers preflight this call because supabase-js sends Authorization and
// x-client-info. Origins are pinned — never '*' — matching delete-account.
const ALLOWED_ORIGINS = [
  Deno.env.get('SITE_URL'),
  'https://ourhomefolder.com',
  'https://www.ourhomefolder.com',
  'http://localhost:3000',
  'http://localhost:3055'
].filter((value): value is string => Boolean(value));

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');
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

// Preflight only — deliberately performs no work and touches no data.
function corsPreflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

// Verify the caller's token here rather than decoding it unchecked.
//
// The gateway does verify signatures while verify_jwt = true, and decoding
// alone was correct against that configuration. But this handler holds an
// Anthropic key: if the flag is ever flipped — one `deploy --no-verify-jwt`,
// one dashboard toggle, one config drift — an unsigned token with an
// attacker-chosen `sub` would pass, giving unauthenticated model spend with a
// fresh quota bucket per request. Verifying here costs one round-trip on a
// call that already makes an inference request, and removes the dependency on
// a setting stored somewhere else. Same stance as delete-account.
async function verifiedUserId(
  supabaseUrl: string,
  anonKey: string,
  authorization: string | null
): Promise<string | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } }
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

Deno.serve(async (request) => {
  // supabase.functions.invoke sends Authorization + Content-Type, which makes
  // the browser preflight. Answering OPTIONS with a pinned origin keeps the
  // scanner working without ever needing a wildcard ACAO.
  if (request.method === 'OPTIONS') {
    return corsPreflight(request);
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, corsHeaders(request));
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error('analyze-plate: not configured');
    return json({ error: 'Not configured.' }, 503, corsHeaders(request));
  }

  // Checked separately from the platform env so the message can say what is
  // actually going on: the feature exists but the founder has not enabled the
  // vision key yet.
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    console.error('analyze-plate: ANTHROPIC_API_KEY not set');
    return json({ error: 'Not configured.', detail: 'Data-plate scanning is not enabled yet.' }, 503, corsHeaders(request));
  }

  const userId = await verifiedUserId(supabaseUrl, anonKey, request.headers.get('Authorization'));
  if (!userId) {
    return json({ error: 'Not signed in.' }, 401, corsHeaders(request));
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Enforce the cap with the service role, next to the key — plate_scans is
  // service-role-write-only precisely so the quota cannot be reset client-side.
  const [okScans, allAttempts] = await Promise.all([
    supabase
      .from('plate_scans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'ok'),
    supabase.from('plate_scans').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  ]);

  const count = okScans.count;
  const attempts = allAttempts.count;

  if (okScans.error || count === null || allAttempts.error || attempts === null) {
    console.error('analyze-plate: could not count scans', {
      code: okScans.error?.code ?? allAttempts.error?.code
    });
    return json({ error: 'Could not check your scan allowance. Try again in a moment.' }, 500, corsHeaders(request));
  }

  const { data: portfolioEntitlement } = await supabase
    .from('entitlements')
    .select('id')
    .eq('user_id', userId)
    .eq('product_key', 'portfolio_plan')
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .limit(1)
    .maybeSingle();

  const cap = portfolioEntitlement ? PORTFOLIO_SCAN_CAP : FREE_SCAN_CAP;

  if (count >= cap) {
    return json(
      {
        error: portfolioEntitlement
          ? 'You have hit the scan safety ceiling. Get in touch and we will raise it.'
          : `You have used all ${FREE_SCAN_CAP} free data-plate scans. The Portfolio plan includes many more.`,
        scans_used: count,
        scan_cap: cap
      },
      429,
      corsHeaders(request)
    );
  }

  if (attempts >= Math.ceil(cap * ATTEMPT_CEILING_MULTIPLIER)) {
    return json(
      {
        error:
          'Too many scans have failed on this account for us to keep trying. Enter the details by hand, or get in touch.',
        scans_used: count,
        scan_cap: cap
      },
      429,
      corsHeaders(request)
    );
  }

  let body: { image_base64?: unknown; media_type?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400, corsHeaders(request));
  }

  const imageBase64 = typeof body.image_base64 === 'string' ? body.image_base64 : '';
  const mediaType = typeof body.media_type === 'string' ? body.media_type : '';

  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return json({ error: 'Send a JPEG, PNG, or WebP photo.' }, 400, corsHeaders(request));
  }

  if (imageBase64.length === 0 || imageBase64.length > MAX_BASE64_LENGTH) {
    return json({ error: 'Photo is missing or too large. It should be under ~1.5MB after compression.' }, 400, corsHeaders(request));
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  try {
    // ONE call per scan. Cheap tier by mandate (docs/COST_GOVERNANCE.md) —
    // do not upgrade this model without founder approval.
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 }
            },
            { type: 'text', text: EXTRACTION_INSTRUCTIONS }
          ]
        }
      ],
      output_config: {
        format: { type: 'json_schema', schema: PLATE_SCHEMA }
      }
      // deno-lint-ignore no-explicit-any -- output_config may trail the esm.sh typings
    } as any);

    const textBlock = (response.content as Array<{ type: string; text?: string }>).find(
      (block) => block.type === 'text' && typeof block.text === 'string'
    );

    if (!textBlock?.text) {
      throw new Error('empty model response');
    }

    const parsed = JSON.parse(textBlock.text) as Record<string, unknown>;

    // The photo itself is now out of scope — nothing above stored it, and it
    // is not referenced again. Only the usage row persists.
    const { error: logError } = await supabase.from('plate_scans').insert({
      user_id: userId,
      status: 'ok'
    });
    if (logError) {
      // The scan succeeded; a missed log row under-counts usage, which only
      // errs in the user's favour. Log and carry on.
      console.error('analyze-plate: could not record scan', { code: logError.code });
    }

    return json(
      {
        brand: parsed.brand ?? null,
        model_number: parsed.model_number ?? null,
        serial_number: parsed.serial_number ?? null,
        manufacture_year: parsed.manufacture_year ?? null,
        confidence: parsed.confidence ?? 'low',
        notes: parsed.notes ?? null,
        scans_used: count + 1,
        scan_cap: cap
      },
      200,
      corsHeaders(request)
    );
  } catch (apiError) {
    console.error('analyze-plate: vision call failed', {
      message: apiError instanceof Error ? apiError.message : 'unknown'
    });

    await supabase.from('plate_scans').insert({ user_id: userId, status: 'failed' });

    return json({ error: 'The scanner had trouble with that photo. Try again in a moment.' }, 502, corsHeaders(request));
  }
});

function json(body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra }
  });
}
