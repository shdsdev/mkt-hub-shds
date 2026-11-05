CREATE TABLE "checklist_template_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_template_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"notes" text,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_template_groups" ADD CONSTRAINT "checklist_template_groups_template_id_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_template_tasks" ADD CONSTRAINT "checklist_template_tasks_group_id_checklist_template_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."checklist_template_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_template_tasks" ADD CONSTRAINT "checklist_template_tasks_parent_task_id_checklist_template_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."checklist_template_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklist_template_groups_template_position_idx" ON "checklist_template_groups" USING btree ("template_id","position");--> statement-breakpoint
CREATE INDEX "checklist_template_tasks_group_position_idx" ON "checklist_template_tasks" USING btree ("group_id","position");--> statement-breakpoint
CREATE INDEX "checklist_templates_organization_idx" ON "checklist_templates" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "public"."checklist_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."checklist_template_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."checklist_template_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "public"."checklist_templates", "public"."checklist_template_groups", "public"."checklist_template_tasks" FROM PUBLIC, anon, authenticated;
