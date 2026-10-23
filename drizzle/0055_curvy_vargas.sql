CREATE TYPE "public"."ga4_delivery_status" AS ENUM('pending', 'processing', 'received', 'failed', 'uncertain', 'cancelled');--> statement-breakpoint
CREATE TABLE "ga4_event_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracking_event_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"short_link_id" uuid,
	"source_type" "tracking_source_type" NOT NULL,
	"status" "ga4_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ga4_event_outbox_tracking_event_unique" UNIQUE("tracking_event_id")
);
--> statement-breakpoint
ALTER TABLE "ga4_event_outbox" ADD CONSTRAINT "ga4_event_outbox_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ga4_event_outbox" ADD CONSTRAINT "ga4_event_outbox_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ga4_event_outbox" ADD CONSTRAINT "ga4_event_outbox_short_link_id_short_links_id_fk" FOREIGN KEY ("short_link_id") REFERENCES "public"."short_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ga4_event_outbox_ready_idx" ON "ga4_event_outbox" USING btree ("status","available_at");--> statement-breakpoint
