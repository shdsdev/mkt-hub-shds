CREATE TYPE "public"."internal_notification_type" AS ENUM('registration_submitted', 'registration_review_blocked', 'registration_decision');--> statement-breakpoint
ALTER TYPE "public"."event_registration_review_status" ADD VALUE 'waitlisted' BEFORE 'rejected';--> statement-breakpoint
ALTER TYPE "public"."event_registration_status" ADD VALUE 'pending_review' BEFORE 'confirmed';--> statement-breakpoint
ALTER TYPE "public"."event_registration_status" ADD VALUE 'rejected' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'registration_waitlisted' BEFORE 'winner_email';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'registration_rejected' BEFORE 'winner_email';--> statement-breakpoint
CREATE TABLE "user_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"type" "internal_notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
 );
 --> statement-breakpoint
