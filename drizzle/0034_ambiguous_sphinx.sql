ALTER TYPE "public"."notification_status" ADD VALUE 'resent';--> statement-breakpoint
ALTER TYPE "public"."notification_status" ADD VALUE 'unknown';--> statement-breakpoint
ALTER TYPE "public"."notification_subject_type" ADD VALUE 'raffle_draw';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'winner_email';