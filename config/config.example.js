/**
 * config.example.js
 * ---------------------------------------------------------------------------
 * PayLink does not read config from this file at runtime — it's here purely
 * as documentation of every environment variable / secret the Worker expects
 * (see wrangler.toml [vars] and the `wrangler secret put` commands below).
 *
 * Copy this file's shape into your own notes; do NOT put real secrets in any
 * file that gets committed to git. Real values are set with:
 *
 *   wrangler secret put ADMIN_KEY
 *
 * and plain (non-secret) defaults live under [vars] in wrangler.toml.
 * ---------------------------------------------------------------------------
 */

module.exports = {
  // --- required secret (wrangler secret put ADMIN_KEY) ----------------------
  // The key that unlocks /admin and every /api/admin/* + /api/sms/* route.
  // Generate a long random value, e.g.: openssl rand -hex 32
  ADMIN_KEY: "REPLACE_WITH_A_LONG_RANDOM_SECRET",

  // --- D1 database binding (declared in wrangler.toml, not here) ----------
  // env.DB  ->  the `paylink-db` D1 database bound in wrangler.toml.

  // --- everything else (fees, receiving numbers, feature switches,
  // support links, site name) is stored in the `settings` table and is
  // fully editable live from /admin — nothing else needs to be hardcoded.
  // See database/schema.sql + src/settings.js for the full list of keys
  // and their defaults.
};
