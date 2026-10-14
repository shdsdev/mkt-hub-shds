ALTER TYPE "public"."user_role" ADD VALUE 'RECEPTION' BEFORE 'MARKETING_MANAGER';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "check_in_confirmation_required" boolean DEFAULT true NOT NULL;
