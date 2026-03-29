ALTER TABLE "gifts" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "gifts" ALTER COLUMN "status" SET DEFAULT 'PENDING'::text;--> statement-breakpoint
DROP TYPE "public"."gift_status";--> statement-breakpoint
CREATE TYPE "public"."gift_status" AS ENUM('PENDING', 'FUNDED', 'LOCKED', 'UNLOCKED', 'CLAIMED');--> statement-breakpoint
ALTER TABLE "gifts" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"public"."gift_status";--> statement-breakpoint
ALTER TABLE "gifts" ALTER COLUMN "status" SET DATA TYPE "public"."gift_status" USING "status"::"public"."gift_status";--> statement-breakpoint
ALTER TABLE "gifts" ADD COLUMN "cover_image_id" text;--> statement-breakpoint
ALTER TABLE "gifts" ADD COLUMN "link_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "otp_failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "otp_attempts_window_start" timestamp;--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");