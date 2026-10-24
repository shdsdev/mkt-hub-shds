ALTER TABLE "analytics_consents" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "analytics_consents" SET "expires_at" = "granted_at" + INTERVAL '180 days' WHERE "expires_at" IS NULL;--> statement-breakpoint
ALTER TABLE "analytics_consents" ALTER COLUMN "expires_at" SET NOT NULL;
