CREATE TYPE "public"."benefit_kind" AS ENUM('discount', 'gift');--> statement-breakpoint
CREATE TYPE "public"."benefit_redemption_scope" AS ENUM('attendee', 'registration');--> statement-breakpoint
CREATE TYPE "public"."benefit_redemption_status" AS ENUM('active', 'annulled');--> statement-breakpoint
CREATE TABLE "event_benefit_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"benefit_id" uuid NOT NULL,
	"scope" "benefit_redemption_scope" NOT NULL,
	"attendee_id" uuid NOT NULL,
	"registration_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"status" "benefit_redemption_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"annulled_at" timestamp with time zone,
	"annulled_by" uuid,
	"annulment_reason" text
);
--> statement-breakpoint
CREATE TABLE "event_benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" "benefit_kind" NOT NULL,
	"name" text,
	"percentage" integer,
	"quantity" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_benefits_percentage_range" CHECK ("event_benefits"."percentage" between 0 and 100),
	CONSTRAINT "event_benefits_quantity_non_negative" CHECK ("event_benefits"."quantity" >= 0)
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "benefit_redemption_scope" "benefit_redemption_scope";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "benefit_redemption_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_benefit_redemptions" ADD CONSTRAINT "event_benefit_redemptions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_benefit_redemptions" ADD CONSTRAINT "event_benefit_redemptions_benefit_id_event_benefits_id_fk" FOREIGN KEY ("benefit_id") REFERENCES "public"."event_benefits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_benefit_redemptions" ADD CONSTRAINT "event_benefit_redemptions_attendee_id_event_attendees_id_fk" FOREIGN KEY ("attendee_id") REFERENCES "public"."event_attendees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_benefit_redemptions" ADD CONSTRAINT "event_benefit_redemptions_registration_id_event_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_benefit_redemptions" ADD CONSTRAINT "event_benefit_redemptions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_benefit_redemptions" ADD CONSTRAINT "event_benefit_redemptions_annulled_by_users_id_fk" FOREIGN KEY ("annulled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_benefits" ADD CONSTRAINT "event_benefits_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_benefit_redemptions_event_attendee_active_unique" ON "event_benefit_redemptions" USING btree ("event_id","attendee_id") WHERE "event_benefit_redemptions"."scope" = 'attendee' AND "event_benefit_redemptions"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "event_benefit_redemptions_event_registration_active_unique" ON "event_benefit_redemptions" USING btree ("event_id","registration_id") WHERE "event_benefit_redemptions"."scope" = 'registration' AND "event_benefit_redemptions"."status" = 'active';
