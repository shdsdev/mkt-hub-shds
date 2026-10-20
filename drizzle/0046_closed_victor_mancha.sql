ALTER TABLE "events" ADD COLUMN "telegram_message_template" text;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "message_template" text;