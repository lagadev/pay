-- ============================================================================
-- PayLink — D1 (SQLite) schema
-- Apply with:  wrangler d1 execute paylink-db --file=./database/schema.sql
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- settings: every editable knob (fees, receiving numbers, on/off switches,
-- support links, announcement banner) lives here so /admin can change
-- everything live without a redeploy. Seed values are in src/settings.js.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- merchants: platform users. They never hold real bKash/Nagad numbers —
-- they invoice against the platform's own numbers and get paid out manually.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS merchants (
  id             TEXT PRIMARY KEY,
  full_name      TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  mobile         TEXT NOT NULL,
  telegram       TEXT,
  password_hash  TEXT NOT NULL,
  password_salt  TEXT NOT NULL,
  api_key        TEXT NOT NULL UNIQUE,
  balance        REAL NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active',   -- active | suspended
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_merchants_email ON merchants(email);
CREATE INDEX IF NOT EXISTS idx_merchants_api_key ON merchants(api_key);

-- ---------------------------------------------------------------------------
-- sessions: merchant dashboard login sessions (bearer token, 30 day TTL)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_merchant ON sessions(merchant_id);

-- ---------------------------------------------------------------------------
-- invoices: one payment request. method is one of
-- 'bkash' | 'nagad' | 'rocket' | 'upay' (chosen by the customer on /pay).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id              TEXT PRIMARY KEY,
  merchant_id     TEXT NOT NULL REFERENCES merchants(id),
  reference       TEXT,
  amount          REAL NOT NULL,
  fee_amount      REAL NOT NULL DEFAULT 0,
  net_amount      REAL NOT NULL DEFAULT 0,
  method          TEXT,
  merchant_number TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | verified | expired
  verified_by     TEXT,                              -- 'sms' | 'admin'
  trx_id          TEXT,
  sender_number   TEXT,
  callback_url    TEXT,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  verified_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_invoices_merchant ON invoices(merchant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_trx ON invoices(trx_id);

-- ---------------------------------------------------------------------------
-- sms_transactions: raw records forwarded by the Android SMS-forwarder app,
-- matched against a pending invoice by trx_id / amount+window.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_transactions (
  id                 TEXT PRIMARY KEY,
  trx_id             TEXT NOT NULL,
  amount             REAL NOT NULL,
  sender_number      TEXT,
  method             TEXT NOT NULL,
  received_at        INTEGER NOT NULL,
  raw_sms            TEXT,
  matched_invoice_id TEXT REFERENCES invoices(id),
  created_at         INTEGER NOT NULL,
  UNIQUE(trx_id, method)
);
CREATE INDEX IF NOT EXISTS idx_sms_trx ON sms_transactions(trx_id);

-- ---------------------------------------------------------------------------
-- payouts: merchant withdrawal requests. Sit "pending" until the platform
-- owner manually sends the money from /admin and marks it complete.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payouts (
  id            TEXT PRIMARY KEY,
  merchant_id   TEXT NOT NULL REFERENCES merchants(id),
  amount        REAL NOT NULL,
  fee_amount    REAL NOT NULL DEFAULT 0,
  net_amount    REAL NOT NULL DEFAULT 0,
  method        TEXT NOT NULL DEFAULT 'bkash',
  payout_number TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | completed | rejected
  note          TEXT,
  created_at    INTEGER NOT NULL,
  processed_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_payouts_merchant ON payouts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

-- ---------------------------------------------------------------------------
-- balance_adjustments: audit trail for manual admin credits/debits so every
-- balance change (not just invoices/payouts) stays traceable.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS balance_adjustments (
  id          TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  amount      REAL NOT NULL,   -- positive = credit, negative = debit
  reason      TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_adjustments_merchant ON balance_adjustments(merchant_id);
