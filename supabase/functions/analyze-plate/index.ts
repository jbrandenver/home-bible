// Appliance data-plate scanner: photo → brand / model / serial / year.
//
// PRIVACY STANCE: the photo is processed in one stateless vision call and then
// discarded. It is never written to storage, never logged, never retained by
// this function, and (per Anthropic's API terms) never used for training. The
// only thing persisted is a plate_scans usage row (who scanned, when, ok or
// failed) so the cap can be enforced server-side, next to the API key.
//
// AUTH: `verify_jwt = true` in config.toml — the Supabase gateway validates
// the caller's JWT signature before this function ever runs, so the handler
// only needs to *read* the already-verified token to learn who is calling.
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

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

// The gateway has already verified this token's signature (verify_jwt = true),
// so decoding the payload — without re-verifying — is safe here and is the
// documented way for an Edge Function to learn the caller's user id.
function userIdFromVerifiedJwt(authorization: string | null): string | null {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  const parts = authorization.slice('Bearer '.length).split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('analyze-plate: not configured');
    return json({ error: 'Not configured.' }, 503);
  }

  // Checked separately from the platform env so the message can say what is
  // actually going on: the feature exists but the founder has not enabled the
  // vision key yet.
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    console.error('analyze-plate: ANTHROPIC_API_KEY not set');
    return json({ error: 'Not configured.', detail: 'Data-plate scanning is not enabled yet.' }, 503);
  }

  const userId = userIdFromVerifiedJwt(request.headers.get('Authorization'));
  if (!userId) {
    return json({ error: 'Not signed in.' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Enforce the cap with the service role, next to the key — plate_scans is
  // service-role-write-only precisely so the quota cannot be reset client-side.
  const { count, error: countError } = await supabase
    .from('plate_scans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError || count === null) {
    console.error('analyze-plate: could not count scans', { code: countError?.code });
    return json({ error: 'Could not check your scan allowance. Try again in a moment.' }, 500);
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
          : `You have used all ${FREE_SCAN_CAP} free data-plate scans. The Portfolio plan includes many more.`
      },
      429
    );
  }

  let body: { image_base64?: unknown; media_type?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const imageBase64 = typeof body.image_base64 === 'string' ? body.image_base64 : '';
  const mediaType = typeof body.media_type === 'string' ? body.media_type : '';

  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return json({ error: 'Send a JPEG, PNG, or WebP photo.' }, 400);
  }

  if (imageBase64.length === 0 || imageBase64.length > MAX_BASE64_LENGTH) {
    return json({ error: 'Photo is missing or too large. It should be under ~1.5MB after compression.' }, 400);
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

    return json({
      brand: parsed.brand ?? null,
      model_number: parsed.model_number ?? null,
      serial_number: parsed.serial_number ?? null,
      manufacture_year: parsed.manufacture_year ?? null,
      confidence: parsed.confidence ?? 'low',
      notes: parsed.notes ?? null,
      scans_used: count + 1,
      scan_cap: cap
    });
  } catch (apiError) {
    console.error('analyze-plate: vision call failed', {
      message: apiError instanceof Error ? apiError.message : 'unknown'
    });

    await supabase.from('plate_scans').insert({ user_id: userId, status: 'failed' });

    return json({ error: 'The scanner had trouble with that photo. Try again in a moment.' }, 502);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
