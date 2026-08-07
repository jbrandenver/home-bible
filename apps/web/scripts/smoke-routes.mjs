#!/usr/bin/env node
// Boots the production build and asserts every important route actually
// renders. Guards the class of breakage nothing else here catches: typecheck,
// lint and vitest all pass happily while a page throws on render, and `next
// build` succeeds for routes it never prerenders.
//
//   node scripts/smoke-routes.mjs                       # builds nothing, starts `next start`
//   node scripts/smoke-routes.mjs http://localhost:3000 # check a server already running
//
// Requires `next build` to have run first. Exit 0 = every route returned the
// status it should. Exit 1 = at least one did not.

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');
const externalOrigin = process.argv[2]?.replace(/\/$/, '') ?? null;
const PORT = Number(process.env.SMOKE_PORT ?? 3999);

// 200 = renders for a signed-out visitor. The app routes are client-rendered
// shells that redirect to sign-in AFTER hydration, so the shell itself is a
// 200 — that is exactly what we want to assert, because a throwing page is a
// 500 and an unrouted one is a 404.
const ROUTES = [
  // Public / marketing.
  ['/', 200],
  ['/pricing', 200],
  ['/features', 200],
  ['/pro', 200],
  ['/terms', 200],
  ['/privacy', 200],
  // Auth.
  ['/sign-in', 200],
  ['/sign-up', 200],
  ['/reset-password', 200],
  // Demo / first-run, the path most new users actually take.
  ['/welcome', 200],
  // App shells. Note there is no /rooms index — rooms are /rooms/[id] and
  // are added from /add-rooms.
  ['/dashboard', 200],
  ['/settings', 200],
  ['/add-rooms', 200],
  ['/repairs', 200],
  ['/utilities', 200],
  ['/documents', 200],
  ['/warranties', 200],
  ['/reminders', 200],
  ['/assets', 200],
  ['/issues', 200],
  ['/receipts', 200],
  ['/sharing', 200],
  ['/handover', 200],
  ['/emergency', 200],
  ['/maintenance', 200],
  ['/portfolio', 200],
  ['/compliance', 200],
  ['/tenancies', 200],
  ['/automation', 200],
  ['/tools', 200],
  ['/more', 200],
  // The offline fallback the service worker serves; if this 404s, every
  // offline navigation lands on nothing.
  ['/offline', 200],
  // Generated responses.
  ['/robots.txt', 200],
  ['/sitemap.xml', 200],
  ['/manifest.webmanifest', 200],
  ['/sw.js', 200],
  // Deliberate 404s. /mvp-test is dev-only by design; the random path proves
  // the 404 path itself renders instead of throwing.
  ['/mvp-test', 404],
  ['/this-route-does-not-exist', 404]
];

// Legacy URLs that must keep redirecting; users have these bookmarked.
const REDIRECTS = ['/property/abc', '/property/abc/room/def'];

function startServer() {
  const child = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: appDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' }
  });
  child.stdout.on('data', (d) => process.env.SMOKE_VERBOSE && process.stdout.write(`  [next] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`  [next] ${d}`));
  return child;
}

async function waitForReady(origin, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // Any HTTP answer means it is listening; status does not matter yet.
      await fetch(origin, { redirect: 'manual' });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`server did not become ready within ${timeoutMs}ms`);
}

async function main() {
  let server = null;
  let origin = externalOrigin;

  if (!origin) {
    origin = `http://localhost:${PORT}`;
    server = startServer();
    await waitForReady(origin);
  }

  const failures = [];

  for (const [path, expected] of ROUTES) {
    let actual;
    try {
      // redirect: manual so a route that 307s to sign-in is reported as the
      // redirect it is, rather than silently passing as the destination's 200.
      const res = await fetch(`${origin}${path}`, { redirect: 'manual' });
      actual = res.status;
    } catch (error) {
      failures.push(`${path} -> request failed: ${error.message}`);
      continue;
    }
    if (actual !== expected) {
      failures.push(`${path} -> HTTP ${actual}, expected ${expected}`);
    } else {
      console.log(`  ok  ${String(expected).padEnd(3)} ${path}`);
    }
  }

  for (const path of REDIRECTS) {
    try {
      const res = await fetch(`${origin}${path}`, { redirect: 'manual' });
      if (res.status < 300 || res.status >= 400) {
        failures.push(`${path} -> HTTP ${res.status}, expected a 3xx redirect`);
      } else {
        console.log(`  ok  ${res.status} ${path} -> ${res.headers.get('location')}`);
      }
    } catch (error) {
      failures.push(`${path} -> request failed: ${error.message}`);
    }
  }

  if (server) {
    server.kill('SIGTERM');
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} route check(s) failed:`);
    for (const failure of failures) console.error(`  FAIL  ${failure}`);
    process.exit(1);
  }

  console.log(`\nAll ${ROUTES.length + REDIRECTS.length} route checks passed.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
