-- Add payment verification fields to gifts table
ALTER TABLE "gifts" ADD COLUMN "payment_reference" text;

ALTER TABLE "gifts" ADD COLUMN "payment_provider" text;

ALTER TABLE "gifts" ADD COLUMN "payment_verified_at" timestamp;