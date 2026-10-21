CREATE TABLE "monitoring_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"telegram_chat_id" text,
	"form_alerts_enabled" boolean DEFAULT true NOT NULL,
	"performance_alerts_enabled" boolean DEFAULT true NOT NULL,
	"slow_operation_ms" integer DEFAULT 3000 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
