-- Adds browser-redirect URLs alongside the existing server-to-server webhook.
-- Run this on an existing database that predates successUrl/cancelUrl support:
--
--   wrangler d1 execute paylink-db --remote --file=./database/migrations/0002_add_success_cancel_url.sql

ALTER TABLE invoices ADD COLUMN success_url TEXT;
ALTER TABLE invoices ADD COLUMN cancel_url  TEXT;
