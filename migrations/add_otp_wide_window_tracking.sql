-- Migration: Add OTP wide window tracking fields
-- Description: Adds fields to track cumulative OTP failures over 1-hour window
-- Date: 2026-03-23

-- Add new columns to users table for tracking OTP attempts over time
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS otp_failed_attempts INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS otp_attempts_window_start TIMESTAMP;

-- Add comments for documentation
COMMENT ON COLUMN users.otp_failed_attempts IS 'Cumulative count of failed OTP attempts within the current 1-hour window';
COMMENT ON COLUMN users.otp_attempts_window_start IS 'Start timestamp of the current 1-hour tracking window for OTP failures';

-- Create index for efficient querying of locked accounts
CREATE INDEX IF NOT EXISTS idx_users_lock_until ON users(lock_until) WHERE lock_until IS NOT NULL;

-- Create index for OTP attempt tracking
CREATE INDEX IF NOT EXISTS idx_users_otp_window ON users(otp_attempts_window_start) WHERE otp_attempts_window_start IS NOT NULL;
