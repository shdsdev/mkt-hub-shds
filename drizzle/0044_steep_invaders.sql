-- Custom SQL migration file, put your code below! --
ALTER TABLE "event_registrations" ALTER COLUMN "status" SET DEFAULT 'pending_review';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "telegram_chat_id" text;--> statement-breakpoint
UPDATE "event_attendees" SET "occupation" = 'wholesaler' WHERE "occupation" = 'distributor';--> statement-breakpoint
UPDATE "event_attendees" SET "occupation" = 'architect-decorator' WHERE "occupation" IN ('architect', 'decorator');--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_notifications_recipient_dedupe_unique" ON "user_notifications" USING btree ("recipient_user_id","dedupe_key");
