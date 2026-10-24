CREATE TABLE "analytics_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ga4_event_outbox" ADD COLUMN "consent_id" uuid;--> statement-breakpoint
CREATE INDEX "analytics_consents_client_idx" ON "analytics_consents" USING btree ("client_id");--> statement-breakpoint
ALTER TABLE "ga4_event_outbox" ADD CONSTRAINT "ga4_event_outbox_consent_id_analytics_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."analytics_consents"("id") ON DELETE no action ON UPDATE no action;