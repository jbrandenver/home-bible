import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Deliberately bare: this app has no ISR and no server data cache — pages are
// statically prerendered at build time and all live data is fetched from
// Supabase by the browser under RLS. The R2 incremental-cache override in the
// OpenNext docs would add a paid-surface dependency for nothing
// (docs/COST_GOVERNANCE.md).
export default defineCloudflareConfig();
