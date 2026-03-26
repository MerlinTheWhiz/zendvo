-- Migration: Add default 'USDC' to currency field in gifts table
-- This standardizes the asset currency identity for gifts and enables multi-currency support

-- Add default value to currency column
ALTER TABLE Gift ADD COLUMN currency_new TEXT NOT NULL DEFAULT 'USDC';

-- Copy existing data
UPDATE Gift SET currency_new = currency WHERE currency IS NOT NULL;

-- Drop old column and rename new one
ALTER TABLE Gift DROP COLUMN currency;
ALTER TABLE Gift RENAME COLUMN currency_new TO currency;

-- Add migration metadata
INSERT INTO drizzle_migration (id, name, created_at) VALUES ('add_currency_default_usdc', 'add_currency_default_usdc', datetime('now'));
