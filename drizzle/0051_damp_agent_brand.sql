ALTER TYPE "public"."user_role" ADD VALUE 'EVENT_EDITOR';--> statement-breakpoint
CREATE TABLE "event_editors" (
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_editors" ADD CONSTRAINT "event_editors_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_editors" ADD CONSTRAINT "event_editors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_editors_event_user_unique" ON "event_editors" USING btree ("event_id","user_id");
