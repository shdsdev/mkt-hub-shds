CREATE TYPE "public"."checklist_task_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
ALTER TABLE "event_checklist_tasks" ADD COLUMN "priority" "checklist_task_priority" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_checklist_tasks" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "event_checklist_tasks" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_checklist_tasks" ADD COLUMN "completed_by" uuid;--> statement-breakpoint
ALTER TABLE "event_checklist_tasks" ADD CONSTRAINT "event_checklist_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_checklist_tasks" ADD CONSTRAINT "event_checklist_tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;