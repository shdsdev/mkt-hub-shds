CREATE TABLE "event_checklist_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_checklist_comments" ADD CONSTRAINT "event_checklist_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_checklist_comments" ADD CONSTRAINT "event_checklist_comments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_checklist_comments" ADD CONSTRAINT "event_checklist_comments_task_id_event_checklist_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."event_checklist_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_checklist_comments" ADD CONSTRAINT "event_checklist_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_checklist_comments_task_created_idx" ON "event_checklist_comments" USING btree ("task_id","created_at");--> statement-breakpoint
ALTER TABLE "public"."event_checklist_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "public"."event_checklist_comments" FROM PUBLIC, anon, authenticated;
