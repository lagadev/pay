-- Run this ONLY if you already have an older PayLink database (bKash + Nagad
-- only) and are upgrading. A brand new database should just use schema.sql.
--
--   wrangler d1 execute paylink-db --file=./database/migrations/0001_add_rocket_upay_and_adjustments.sql

ALTER TABLE invoices ADD COLUMN verified_by TEXT;
ALTER TABLE payouts  ADD COLUMN method TEXT NOT NULL DEFAULT 'bkash';
ALTER TABLE payouts  ADD COLUMN note   TEXT;

CREATE TABLE IF NOT EXISTS balance_adjustments (
  id          TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  amount      REAL NOT NULL,
  reason      TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_adjustments_merchant ON balance_adjustments(merchant_id);

-- Seed the new settings keys (safe no-ops if they already exist)
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('MERCHANT_ROCKET_NUMBER', '01700000000'),
  ('MERCHANT_UPAY_NUMBER',   '01800000000'),
  ('ROCKET_ENABLED', 'true'),
  ('UPAY_ENABLED', 'true'),
  ('SUPPORT_TELEGRAM', ''),
  ('SUPPORT_WHATSAPP', ''),
  ('SUPPORT_PHONE', ''),
  ('ANNOUNCEMENT_TEXT', '');
