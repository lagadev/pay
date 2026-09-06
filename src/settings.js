// ============================================================================
// src/settings.js — the `settings` table is the single source of truth for
// every editable knob (fees, receiving numbers, feature switches, support
// links, announcement banner). Everything here is changeable live from
// /admin without a redeploy.
// ============================================================================

export const DEFAULTS = {
  SITE_NAME: "PayLink",

  MERCHANT_BKASH_NUMBER: "01700000000",
  MERCHANT_NAGAD_NUMBER: "01700000000",
  MERCHANT_ROCKET_NUMBER: "01700000000",
  MERCHANT_UPAY_NUMBER: "01700000000",

  INVOICE_TTL_MINUTES: "15",
  INVOICE_FEE_PERCENT: "2",
  PAYOUT_FEE_PERCENT: "10",
  PAYOUT_MIN: "20",

  SIGNUP_ENABLED: "true",
  BKASH_ENABLED: "true",
  NAGAD_ENABLED: "true",
  ROCKET_ENABLED: "true",
  UPAY_ENABLED: "true",
  MAINTENANCE_MODE: "false",

  // Support / contact — shown on the docs page + pay page footer.
  SUPPORT_TELEGRAM: "",
  SUPPORT_WHATSAPP: "",
  SUPPORT_PHONE: "",

  // Free-text banner shown at the top of the merchant dashboard. Empty = hidden.
  ANNOUNCEMENT_TEXT: "",

  // Site logo shown in every header/brand mark. Points at the bundled SVG by
  // default; change it from /admin (Settings) to any image URL, or clear it
  // to fall back to a plain text initial.
  LOGO_URL: "/assets/logo.svg",
};

const BOOL_KEYS = ["SIGNUP_ENABLED", "BKASH_ENABLED", "NAGAD_ENABLED", "ROCKET_ENABLED", "UPAY_ENABLED", "MAINTENANCE_MODE"];
const NUM_KEYS = ["INVOICE_TTL_MINUTES", "INVOICE_FEE_PERCENT", "PAYOUT_FEE_PERCENT", "PAYOUT_MIN"];

export async function getSettings(env) {
  const rows = await env.DB.prepare(`SELECT key, value FROM settings`).all();
  const map = {};
  for (const r of rows.results || []) map[r.key] = r.value;
  const g = (k) => (map[k] !== undefined ? map[k] : DEFAULTS[k]);

  const out = {};
  for (const key of Object.keys(DEFAULTS)) {
    const raw = g(key);
    if (BOOL_KEYS.includes(key)) out[key] = raw === "true";
    else if (NUM_KEYS.includes(key)) out[key] = Number(raw);
    else out[key] = raw;
  }
  return out;
}

export async function updateSettings(env, patch) {
  const keys = Object.keys(DEFAULTS);
  const stmts = Object.entries(patch)
    .filter(([k]) => keys.includes(k))
    .map(([k, v]) =>
      env.DB.prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).bind(k, String(v))
    );
  if (stmts.length) await env.DB.batch(stmts);
}

// Subset that's safe to expose on GET /api/settings (no fee revenue internals
// beyond what a merchant/customer needs to see, no admin-only figures).
export function publicSettings(s) {
  return {
    siteName: s.SITE_NAME,
    signupEnabled: s.SIGNUP_ENABLED,
    maintenanceMode: s.MAINTENANCE_MODE,
    methods: {
      bkash: s.BKASH_ENABLED,
      nagad: s.NAGAD_ENABLED,
      rocket: s.ROCKET_ENABLED,
      upay: s.UPAY_ENABLED,
    },
    payoutMin: s.PAYOUT_MIN,
    payoutFeePercent: s.PAYOUT_FEE_PERCENT,
    invoiceFeePercent: s.INVOICE_FEE_PERCENT,
    support: {
      telegram: s.SUPPORT_TELEGRAM,
      whatsapp: s.SUPPORT_WHATSAPP,
      phone: s.SUPPORT_PHONE,
    },
    announcement: s.ANNOUNCEMENT_TEXT,
    logoUrl: s.LOGO_URL,
  };
}

export function merchantNumberFor(settings, method) {
  if (method === "nagad") return settings.MERCHANT_NAGAD_NUMBER;
  if (method === "rocket") return settings.MERCHANT_ROCKET_NUMBER;
  if (method === "upay") return settings.MERCHANT_UPAY_NUMBER;
  return settings.MERCHANT_BKASH_NUMBER;
}
export function isMethodEnabled(settings, method) {
  if (method === "nagad") return settings.NAGAD_ENABLED;
  if (method === "rocket") return settings.ROCKET_ENABLED;
  if (method === "upay") return settings.UPAY_ENABLED;
  if (method === "bkash") return settings.BKASH_ENABLED;
  return false;
}
