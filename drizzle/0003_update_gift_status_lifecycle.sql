-- Update gift status enum to new lifecycle states
-- This migration updates the gift_status enum and transitions existing data

-- Drop the old enum and create the new one
DROP TYPE IF EXISTS gift_status;

CREATE TYPE gift_status AS ENUM (
  'PENDING',
  'FUNDED', 
  'LOCKED',
  'UNLOCKED',
  'CLAIMED'
);

-- Update the gifts table to use the new enum
ALTER TABLE gifts 
DROP COLUMN IF EXISTS status,
ADD COLUMN status gift_status NOT NULL DEFAULT 'PENDING';

-- Transition existing data to new lifecycle states
-- Map old statuses to new ones:
-- pending_otp -> PENDING (initial state, awaiting sender verification)
-- otp_verified -> FUNDED (sender verified, funds ready)
-- pending_review -> PENDING (awaiting admin review)
-- confirmed -> FUNDED (confirmed and ready for processing)
-- completed -> CLAIMED (fully processed and claimed)
-- sent -> FUNDED (sent, awaiting claim)
-- failed -> PENDING (reset to pending for retry)

UPDATE gifts 
SET status = CASE 
  WHEN old_status = 'pending_otp' THEN 'PENDING'
  WHEN old_status = 'otp_verified' THEN 'FUNDED'
  WHEN old_status = 'pending_review' THEN 'PENDING'
  WHEN old_status = 'confirmed' THEN 'FUNDED'
  WHEN old_status = 'completed' THEN 'CLAIMED'
  WHEN old_status = 'sent' THEN 'FUNDED'
  WHEN old_status = 'failed' THEN 'PENDING'
  ELSE 'PENDING'
END;
