CREATE TYPE "public"."event_registration_review_status" AS ENUM('new', 'in_review', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "review_status" "event_registration_review_status" DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "form_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "custom_form_answers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
