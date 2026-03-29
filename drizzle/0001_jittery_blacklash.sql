ALTER TABLE "gifts" ADD COLUMN "is_anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "gifts" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "gifts" ADD COLUMN "cover_image_id" text;--> statement-breakpoint
ALTER TABLE "gifts" ADD COLUMN "link_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "device_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "otp_failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "otp_attempts_window_start" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_phone_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "gift_slug_idx" ON "gifts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_slug_unique" UNIQUE("slug");