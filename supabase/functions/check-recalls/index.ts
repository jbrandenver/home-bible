// CPSC recall checker.
//
// Invoked daily by pg_cron. Loads every non-deleted asset that has both a
// brand and a model, groups them by brand, queries the free, keyless CPSC
// Recall API once per brand, and writes conservative matches into
// public.recall_matches with the service role (users have no INSERT policy —
// see migration 024).
//
// FREE BY CONSTRUCTION. The CPSC API (saferproducts.gov) is public, keyless
// and free; this function makes at most ~30 outbound requests per run with a
// polite delay between them. There is nothing here that can ever bill anyone.
//
// SAFE BEFORE CONFIGURATION. With no RECALL_CRON_SECRET set it refuses every
// request with a 503, same stance as send-digest's unconfigured mode: inert
// rather than broken, and switching it on later is one `supabase secrets set`.

import { createClient } from 'npm:@supabase/supabase-js@2.112.0';

const CPSC_RECALL_ENDPOINT = 'https://www.saferproducts.gov/RestWebServices/Recall';
// Politeness cap: a run queries at most this many distinct brands. With a
// daily schedule the remainder is simply picked up over the following days as
// ordering shifts; the response notes when the cap was hit.
const MAX_BRANDS_PER_RUN = 30;
const DELAY_BETWEEN_CALLS_MS = 500;
// Assets are paged rather than loaded whole: the table grows without bound as
// households add appliances, and one oversized run would OOM the function and
// silently stop recall monitoring — a safety feature — for every customer.
const ASSET_PAGE_SIZE = 1000;
const MAX_ASSET_PAGES = 50;

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

type AssetRow = {
  id: string;
  property_id: string;
  brand: string;
  model: string;
};

type CpscRecall = {
  RecallNumber?: string;
  RecallID?: number;
  Title?: string;
  Description?: string;
  URL?: string;
  Products?: Array<{ Name?: string; Description?: string; Model?: string }>;
  Hazards?: Array<{ Name?: string }>;
  Remedies?: Array<{ Name?: string }>;
};

// --- Pure model matcher ------------------------------------------------------
//
// DUPLICATE, KEPT IN SYNC with apps/web/lib/recalls.ts. Deno cannot import the
// web workspace, so the canonical, unit-tested copy lives in
// apps/web/lib/recalls.ts (tests/recalls-lifespans.test.ts) and this is a
// byte-for-byte copy of the two functions. Change both together.
//
// The matcher is deliberately conservative: exact containment of the
// normalized model number in the recall text, nothing fuzzier. A missed recall
// (false negative) is recoverable; a false positive is a safety notice wrongly
// attached to someone's appliance, which destroys trust in every future
// notice. So: no fuzzy matching, no model-range expansion (a recall listing
// "models WF45T6000A through WF45T6999Z" only matches an asset whose exact
// model string appears), and short model strings are rejected entirely.

/** Uppercase and strip spaces/dashes so "WF45-T6000 A" and "wf45t6000a" agree. */
function normalizeModelNumber(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.toUpperCase().replace(/[\s-]+/g, '');
}

/**
 * Below this length, normalized model strings ("X5", "200") appear in ordinary
 * prose and recall numbers far too often to be evidence of anything.
 */
const MIN_MODEL_MATCH_LENGTH = 4;

/**
 * Whether an asset's model number appears in any of the given recall text
 * fragments (product model fields, titles, descriptions).
 */
function modelMatchesRecallText(
  model: string | null | undefined,
  recallTexts: ReadonlyArray<string | null | undefined>
): boolean {
  const normalizedModel = normalizeModelNumber(model);
  if (normalizedModel.length < MIN_MODEL_MATCH_LENGTH) {
    return false;
  }

  return recallTexts.some((text) => normalizeModelNumber(text).includes(normalizedModel));
}

// ----------------------------------------------------------------------------

function recallTextFragments(recall: CpscRecall): string[] {
  const fragments: Array<string | undefined> = [recall.Title, recall.Description];

  for (const product of recall.Products ?? []) {
    fragments.push(product.Model, product.Name, product.Description);
  }

  return fragments.filter((fragment): fragment is string => typeof fragment === 'string');
}

function joinNames(items: Array<{ Name?: string }> | undefined): string | null {
  const names = (items ?? [])
    .map((item) => item.Name?.trim())
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names.join('; ') : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret = Deno.env.get('RECALL_CRON_SECRET');

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Function is not configured.' }, 500);
  }

  // The endpoint is public (cron cannot present a user JWT), so the shared
  // secret is the only thing standing between the internet and a write path
  // into recall_matches. Unlike send-digest there is no useful dry-run without
  // it, so an unset secret refuses outright instead of running open.
  if (!cronSecret) {
    return json({ error: 'Not configured.' }, 503);
  }

  const provided = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!provided || !(await safeEqual(provided, cronSecret))) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const assetData: AssetRow[] = [];
  let assetPagesTruncated = false;

  for (let page = 0; page < MAX_ASSET_PAGES; page += 1) {
    const from = page * ASSET_PAGE_SIZE;
    const { data: pageData, error: assetError } = await supabase
      .from('assets')
      .select('id, property_id, brand, model')
      .is('deleted_at', null)
      .not('brand', 'is', null)
      .not('model', 'is', null)
      .not('property_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + ASSET_PAGE_SIZE - 1);

    if (assetError) {
      console.error('check-recalls: could not load assets', {
        code: assetError.code,
        message: assetError.message,
        page
      });
      return json({ error: 'Could not load assets.' }, 500);
    }

    const rows = (pageData ?? []) as AssetRow[];
    assetData.push(...rows);
    if (rows.length < ASSET_PAGE_SIZE) break;
    if (page === MAX_ASSET_PAGES - 1) assetPagesTruncated = true;
  }

  if (assetPagesTruncated) {
    console.warn('check-recalls: asset page cap reached; remaining assets deferred to a later run', {
      loaded: assetData.length
    });
  }

  const assets = (assetData as AssetRow[]).filter(
    (asset) =>
      asset.brand.trim().length > 0 &&
      normalizeModelNumber(asset.model).length >= MIN_MODEL_MATCH_LENGTH
  );

  // Group assets by brand so each brand is queried exactly once per run.
  const assetsByBrand = new Map<string, { brand: string; assets: AssetRow[] }>();
  for (const asset of assets) {
    const key = asset.brand.trim().toLowerCase();
    const group = assetsByBrand.get(key);
    if (group) {
      group.assets.push(asset);
    } else {
      assetsByBrand.set(key, { brand: asset.brand.trim(), assets: [asset] });
    }
  }

  const brandGroups = [...assetsByBrand.values()];
  const queriedGroups = brandGroups.slice(0, MAX_BRANDS_PER_RUN);
  const brandsSkipped = brandGroups.length - queriedGroups.length;

  let recallsFetched = 0;
  let matchesFound = 0;
  let matchesInserted = 0;
  let brandFetchFailures = 0;

  for (const [index, group] of queriedGroups.entries()) {
    if (index > 0) {
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }

    let recalls: CpscRecall[];
    try {
      const url = `${CPSC_RECALL_ENDPOINT}?format=json&Manufacturer=${encodeURIComponent(group.brand)}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`CPSC responded ${response.status}`);
      }
      recalls = (await response.json()) as CpscRecall[];
    } catch (fetchError) {
      // One flaky brand must not sink the run; tomorrow's run retries it.
      brandFetchFailures += 1;
      console.error('check-recalls: CPSC fetch failed', {
        message: fetchError instanceof Error ? fetchError.message : 'unknown'
      });
      continue;
    }

    if (!Array.isArray(recalls)) {
      brandFetchFailures += 1;
      continue;
    }

    recallsFetched += recalls.length;

    const rows: Array<Record<string, unknown>> = [];
    for (const recall of recalls) {
      const recallNumber = recall.RecallNumber?.trim() || (recall.RecallID ? String(recall.RecallID) : '');
      if (!recallNumber) {
        continue;
      }

      const fragments = recallTextFragments(recall);
      for (const asset of group.assets) {
        if (!modelMatchesRecallText(asset.model, fragments)) {
          continue;
        }

        matchesFound += 1;
        rows.push({
          property_id: asset.property_id,
          asset_id: asset.id,
          recall_number: recallNumber,
          title: recall.Title?.trim() || null,
          hazard: joinNames(recall.Hazards),
          remedy: joinNames(recall.Remedies),
          recall_url: recall.URL?.trim() || null,
          matched_on: `model ${asset.model.trim()}`,
          source: 'cpsc'
        });
      }
    }

    if (rows.length === 0) {
      continue;
    }

    // ON CONFLICT (asset_id, recall_number) DO NOTHING: a match the user has
    // dismissed must never be resurrected to 'open' by the next run.
    const { data: inserted, error: upsertError } = await supabase
      .from('recall_matches')
      .upsert(rows, { onConflict: 'asset_id,recall_number', ignoreDuplicates: true })
      .select('id');

    if (upsertError) {
      console.error('check-recalls: upsert failed', {
        code: upsertError.code,
        message: upsertError.message
      });
      return json({ error: 'Could not store recall matches.' }, 500);
    }

    matchesInserted += (inserted ?? []).length;
  }

  return json({
    ok: true,
    assetsConsidered: assets.length,
    assetsTruncated: assetPagesTruncated,
    brandsQueried: queriedGroups.length,
    brandsSkipped,
    note:
      [
        brandsSkipped > 0
          ? `Brand cap of ${MAX_BRANDS_PER_RUN} reached; ${brandsSkipped} brand(s) deferred to a later run.`
          : null,
        assetPagesTruncated
          ? `Asset cap of ${ASSET_PAGE_SIZE * MAX_ASSET_PAGES} reached; remaining assets deferred to a later run.`
          : null
      ]
        .filter(Boolean)
        .join(' ') || null,
    brandFetchFailures,
    recallsFetched,
    matchesFound,
    matchesInserted
  });
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
