DROP INDEX "event_checklist_groups_event_position_unique";--> statement-breakpoint
DROP INDEX "event_checklist_tasks_group_position_unique";--> statement-breakpoint
CREATE INDEX "event_checklist_groups_event_position_idx" ON "event_checklist_groups" USING btree ("event_id","position");--> statement-breakpoint
CREATE INDEX "event_checklist_tasks_group_position_idx" ON "event_checklist_tasks" USING btree ("group_id","position");--> statement-breakpoint
ALTER TABLE "public"."event_checklist_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."event_checklist_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "public"."event_checklist_groups", "public"."event_checklist_tasks" FROM PUBLIC, anon, authenticated;
