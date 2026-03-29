-- Add short_code column to gifts table for public share links
-- Provides 8-character web-safe short URLs (e.g., /g/xyz123ab)

ALTER TABLE gifts ADD COLUMN short_code TEXT;

ALTER TABLE gifts
ADD CONSTRAINT gifts_short_code_unique UNIQUE (short_code);

CREATE INDEX gift_short_code_idx ON gifts (short_code);