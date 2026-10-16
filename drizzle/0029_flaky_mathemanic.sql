CREATE TYPE "public"."raffle_audit_action" AS ENUM('draw', 'reveal', 'claim', 'invalidate', 'resend_request', 'prize_change', 'status_change');--> statement-breakpoint
CREATE TYPE "public"."raffle_draw_status" AS ENUM('pending_reveal', 'revealed', 'claimed', 'unclaimed', 'invalidated');--> statement-breakpoint
CREATE TYPE "public"."raffle_prize_status" AS ENUM('ready', 'active', 'finished', 'paused');--> statement-breakpoint
CREATE TYPE "public"."raffle_status" AS ENUM('not_configured', 'ready', 'active', 'finished', 'paused');--> statement-breakpoint
CREATE TYPE "public"."raffle_winner_policy" AS ENUM('include_winners', 'exclude_winners');--> statement-breakpoint
CREATE TABLE "raffle_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"raffle_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"prize_id" uuid,
	"draw_id" uuid,
	"actor_user_id" uuid NOT NULL,
	"actor_email" text NOT NULL,
	"action" "raffle_audit_action" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raffle_draws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"raffle_id" uuid NOT NULL,
	"prize_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"attendee_id" uuid NOT NULL,
	"attendee_name" text NOT NULL,
	"attendee_email" text NOT NULL,
	"attendee_code" text NOT NULL,
	"eligible_attendee_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"eligible_count" integer NOT NULL,
	"status" "raffle_draw_status" DEFAULT 'pending_reveal' NOT NULL,
	"drawn_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revealed_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"claimed_by" uuid,
	"invalidated_at" timestamp with time zone,
	"invalidated_by" uuid,
	"reason" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raffle_prizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"raffle_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"instructions" text,
	"claim_deadline_at" timestamp with time zone,
	"fulfillment_contact" text,
	"conditions" text,
	"winner_policy" "raffle_winner_policy" DEFAULT 'exclude_winners' NOT NULL,
	"drawn_quantity" integer DEFAULT 0 NOT NULL,
	"status" "raffle_prize_status" DEFAULT 'ready' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raffles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"status" "raffle_status" DEFAULT 'not_configured' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "raffle_audit" ADD CONSTRAINT "raffle_audit_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_audit" ADD CONSTRAINT "raffle_audit_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_audit" ADD CONSTRAINT "raffle_audit_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_audit" ADD CONSTRAINT "raffle_audit_prize_id_raffle_prizes_id_fk" FOREIGN KEY ("prize_id") REFERENCES "public"."raffle_prizes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_audit" ADD CONSTRAINT "raffle_audit_draw_id_raffle_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."raffle_draws"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_audit" ADD CONSTRAINT "raffle_audit_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_draws" ADD CONSTRAINT "raffle_draws_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_draws" ADD CONSTRAINT "raffle_draws_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_draws" ADD CONSTRAINT "raffle_draws_prize_id_raffle_prizes_id_fk" FOREIGN KEY ("prize_id") REFERENCES "public"."raffle_prizes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_draws" ADD CONSTRAINT "raffle_draws_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_draws" ADD CONSTRAINT "raffle_draws_attendee_id_event_attendees_id_fk" FOREIGN KEY ("attendee_id") REFERENCES "public"."event_attendees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_draws" ADD CONSTRAINT "raffle_draws_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_draws" ADD CONSTRAINT "raffle_draws_invalidated_by_users_id_fk" FOREIGN KEY ("invalidated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_prizes" ADD CONSTRAINT "raffle_prizes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_prizes" ADD CONSTRAINT "raffle_prizes_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_prizes" ADD CONSTRAINT "raffle_prizes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffles" ADD CONSTRAINT "raffles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffles" ADD CONSTRAINT "raffles_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffles" ADD CONSTRAINT "raffles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_draws_raffle_idempotency_unique" ON "raffle_draws" USING btree ("raffle_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "raffles_event_unique" ON "raffles" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "raffle_prizes" ADD CONSTRAINT "raffle_prizes_quantity_positive" CHECK ("quantity" > 0);--> statement-breakpoint
ALTER TABLE "raffle_prizes" ADD CONSTRAINT "raffle_prizes_drawn_quantity_valid" CHECK ("drawn_quantity" >= 0 AND "drawn_quantity" <= "quantity");
