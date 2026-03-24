-- Migration: Add unique constraints and indexes to users table
-- Ensures phone number uniqueness and improves query performance

-- Add named unique constraints for better error handling
ALTER TABLE users ADD CONSTRAINT users_phone_number_unique UNIQUE (phone_number);
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);

-- Add performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_status_idx ON users (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_created_at_idx ON users (created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_phone_number_idx ON users (phone_number);

-- Add comment for documentation
COMMENT ON CONSTRAINT users_phone_number_unique ON users IS 'Ensures each phone number can only be registered to one user account';
COMMENT ON CONSTRAINT users_email_unique ON users IS 'Ensures each email can only be registered to one user account';
COMMENT ON CONSTRAINT users_username_unique ON users IS 'Ensures each username can only be used by one user account';

-- Migration metadata
INSERT INTO drizzle_migration (id, name, created_at) 
VALUES (
  '001_add_phone_unique_constraint',
  'Add unique constraints and performance indexes to users table',
  NOW()
) ON CONFLICT (id) DO NOTHING;
