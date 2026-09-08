CREATE TYPE "public"."tracking_source_type" AS ENUM('qr_scan', 'link_click');--> statement-breakpoint
CREATE TABLE "tracking_events" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"short_link_id" uuid,
	"qr_code_id" uuid,
	"campaign_id" uuid,
	"source_type" "tracking_source_type" NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"visitor_hash" text NOT NULL,
	"session_started_at" timestamp with time zone NOT NULL,
	"device_type" text,
	"geo_country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracking_events_id_created_at_pk" PRIMARY KEY("id","created_at")
) PARTITION BY RANGE ("created_at");
--> statement-breakpoint
-- Partitioned from day one (DATABASE.md) — Postgres can't partition an existing table without
-- recreating it. The rollup job / automatic monthly partition creation is Phase 7; this is just
-- the current month's partition so inserts have somewhere to land.
CREATE TABLE "tracking_events_2026_09" PARTITION OF "tracking_events"
	FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_short_link_id_short_links_id_fk" FOREIGN KEY ("short_link_id") REFERENCES "public"."short_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Indexes on the partitioned parent (DATABASE.md) — Postgres propagates these to each partition.
CREATE INDEX "tracking_events_link_created_idx" ON "tracking_events" ("link_id", "created_at" DESC);--> statement-breakpoint
CREATE INDEX "tracking_events_campaign_created_idx" ON "tracking_events" ("campaign_id", "created_at" DESC) WHERE "campaign_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tracking_events_org_created_idx" ON "tracking_events" ("organization_id", "created_at" DESC);--> statement-breakpoint
CREATE INDEX "tracking_events_qr_created_idx" ON "tracking_events" ("qr_code_id", "created_at" DESC) WHERE "qr_code_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tracking_events_shortlink_created_idx" ON "tracking_events" ("short_link_id", "created_at" DESC) WHERE "short_link_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tracking_events_visitor_session_idx" ON "tracking_events" ("visitor_hash", "session_started_at");--> statement-breakpoint
CREATE INDEX "tracking_events_org_created_nonbot_idx" ON "tracking_events" ("organization_id", "created_at" DESC) WHERE "is_bot" = false;--> statement-breakpoint
CREATE INDEX "tracking_events_org_geo_created_idx" ON "tracking_events" ("organization_id", "geo_country", "created_at" DESC);