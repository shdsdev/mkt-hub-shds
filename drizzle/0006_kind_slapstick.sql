CREATE TABLE "tracking_rollup_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"date" date NOT NULL,
	"clicks_human" integer DEFAULT 0 NOT NULL,
	"clicks_bot" integer DEFAULT 0 NOT NULL,
	"scans_human" integer DEFAULT 0 NOT NULL,
	"scans_bot" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracking_rollup_daily_link_id_date_unique" UNIQUE("link_id","date")
);
--> statement-breakpoint
ALTER TABLE "tracking_rollup_daily" ADD CONSTRAINT "tracking_rollup_daily_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_rollup_daily" ADD CONSTRAINT "tracking_rollup_daily_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE no action ON UPDATE no action;