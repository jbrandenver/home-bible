#!/usr/bin/env node
// Fails when a page serves an executable inline script that the CSP does not
// account for.
//
// Context: script-src currently keeps 'unsafe-inline' because Cloudflare
// injects a per-request inline script (window.__CF$cv$params) that no hash or
// nonce can cover — see docs/SECURITY.md. This checker exists so that the day
// that injection is turned off, the remaining surface is provable rather than
// assumed: run it, and if it reports nothing but the Cloudflare script, the
// 'unsafe-inline' can be dropped and replaced with the printed hashes.
//
//   node scripts/verify-csp.mjs                      # checks production
//   node scripts/verify-csp.mjs http://localhost:3000
//
// Exit 0 = every executable inline script is either absent or already hashed
// in the CSP. Exit 1 = something needs a decision.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const origin = (process.argv[2] ?? 'https://ourhomefolder.com').replace(/\/$/, '');

// A spread of routes: static marketing, an app shell, and an auth page.
const ROUTES = ['/', '/pricing', '/sign-in', '/dashboard', '/settings', '/portfolio'];

// Types the HTML spec does not execute, so script-src never gates them.
const NON_EXECUTABLE = /type\s*=\s*"(application\/(ld\+)?json|importmap|speculationrules)"/i;

// Cloudflare's challenge-platform beacon: body embeds a per-request ray id, so
// it can never be hashed. Recognised so the report distinguishes "we cannot
// fix this in app code" from "someone added an inline script".
const CLOUDFLARE_INJECTED = /window\.__CF\$cv\$params/;

function cspFromConfig() {
  const src = readFileSync(join(here, '..', 'next.config.js'), 'utf8');
  const hashes = new Set();
  for (const m of src.matchAll(/'(sha256-[A-Za-z0-9+/=]+)'/g)) hashes.add(m[1]);
  return { hashes, allowsUnsafeInline: /script-src[^"']*'unsafe-inline'/.test(src) };
}

async function inlineScripts(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const html = await res.text();
  const found = [];
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const [, attrs, body] = m;
    if (/\ssrc\s*=/.test(attrs)) continue;
    if (NON_EXECUTABLE.test(attrs)) continue;
    if (!body.trim()) continue;
    found.push(body);
  }
  return found;
}

const { hashes, allowsUnsafeInline } = cspFromConfig();
let cloudflare = 0;
const unaccounted = new Map();

for (const route of ROUTES) {
  let bodies;
  try {
    bodies = await inlineScripts(origin + route);
  } catch (error) {
    console.error(`✗ ${route}: ${error.message}`);
    process.exitCode = 1;
    continue;
  }

  for (const body of bodies) {
    if (CLOUDFLARE_INJECTED.test(body)) {
      cloudflare += 1;
      continue;
    }
    const hash = 'sha256-' + createHash('sha256').update(body, 'utf8').digest('base64');
    if (hashes.has(hash)) continue;
    if (!unaccounted.has(hash)) unaccounted.set(hash, { routes: [], preview: body.trim().slice(0, 80) });
    unaccounted.get(hash).routes.push(route);
  }
}

console.log(`Checked ${ROUTES.length} route(s) on ${origin}`);
console.log(`  Cloudflare-injected inline scripts : ${cloudflare} (cannot be hashed — per-request)`);
console.log(`  script-src allows 'unsafe-inline'  : ${allowsUnsafeInline}`);
console.log(`  Un-hashed app inline scripts       : ${unaccounted.size}`);

if (unaccounted.size > 0) {
  console.log('\nThese need either a hash in next.config.js or removing:');
  for (const [hash, info] of unaccounted) {
    console.log(`  '${hash}'  routes=${info.routes.join(',')}\n      ${info.preview}…`);
  }
  process.exitCode = 1;
} else if (cloudflare > 0 && allowsUnsafeInline) {
  console.log(
    "\nApp code adds no inline scripts. 'unsafe-inline' is held open only by the\n" +
      'Cloudflare injection — disable that for this zone (Bot Fight Mode /\n' +
      "Rocket Loader) and 'unsafe-inline' can be removed from script-src."
  );
} else if (!allowsUnsafeInline) {
  console.log('\nCSP is nonce/hash-only for scripts and every inline script is accounted for.');
}
