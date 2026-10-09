-- Additive migration for the events-module (PR1 — schema + module core).
-- Hand-authored instead of drizzle-kit-generated: `drizzle/meta/_journal.json` / snapshot chain
-- has pre-existing drift (see apply-progress / PR1 report) that makes a raw `drizzle-kit generate`
-- unsafe right now — it re-emits CREATE TABLE for agent_version_tool_bindings,
-- agent_tool_confirmations, agent_draft_tool_assignments, and agent_pending_tool_interactions,
-- which already have their own un-journaled migrations (0024-0026) on disk. This file contains
-- ONLY the statements a clean diff against the current schema.ts would produce for the new
-- `events` and `notifications` modules; verified against a scratch `drizzle-kit generate` run
-- whose unrelated output was discarded (not committed).
CREATE TYPE "public"."event_registration_source" AS ENUM('public', 'admin_added');--> statement-breakpoint
CREATE TYPE "public"."event_registration_status" AS ENUM('confirmed', 'waitlisted', 'cancelled', 'checked_in');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'closed');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_subject_type" AS ENUM('event_attendee');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('confirmation', 'reminder', 'waitlist_promotion');--> statement-breakpoint
CREATE TABLE "event_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"registration_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"phone" text,
	"company" text,
	"job_title" text,
	"pass_token" text NOT NULL,
	"backup_code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"checked_in_at" timestamp with time zone,
	"checked_in_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"status" "event_registration_status" DEFAULT 'confirmed' NOT NULL,
	"source" "event_registration_source" DEFAULT 'public' NOT NULL,
	"cancel_token" text NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"utm_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"description" text,
	"location" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"capacity" integer,
	"reminder_offset_minutes" integer,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"utm_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subject_type" "notification_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"notification_type" "notification_type" NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "notification_log_subject_type_unique" UNIQUE("subject_id","notification_type")
);
--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_registration_id_event_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_attendees_event_email_active_unique" ON "event_attendees" USING btree ("event_id","email_normalized") WHERE "event_attendees"."is_active";--> statement-breakpoint
CREATE UNIQUE INDEX "event_attendees_event_backup_code_unique" ON "event_attendees" USING btree ("event_id","backup_code");
