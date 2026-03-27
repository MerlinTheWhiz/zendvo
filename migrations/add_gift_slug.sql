-- Add slug column to gifts table for short link support
-- Provides 6-character human-readable short URLs (e.g., /g/Ax9Rk)

ALTER TABLE gifts ADD COLUMN slug TEXT;

ALTER TABLE gifts ADD CONSTRAINT gifts_slug_unique UNIQUE (slug);
CREATE INDEX gift_slug_idx ON gifts (slug);
