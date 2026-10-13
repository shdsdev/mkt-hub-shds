ALTER TABLE "events" ADD COLUMN "registration_form_config" jsonb;
--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "client_brands" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "interests" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "requested_more_companions" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "consents" jsonb;
