ALTER TABLE "raffle_audit" ALTER COLUMN "actor_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "raffle_audit" ADD COLUMN "actor_external_id" text;--> statement-breakpoint
ALTER TABLE "raffle_audit" ADD COLUMN "actor_external_email" text;--> statement-breakpoint
ALTER TABLE "raffle_audit" ADD COLUMN "actor_source" text DEFAULT 'hub' NOT NULL;--> statement-breakpoint
ALTER TABLE "raffle_draws" ADD COLUMN "claimed_by_external" text;