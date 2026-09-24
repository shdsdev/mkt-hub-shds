CREATE TYPE "public"."utm_template_status" AS ENUM('active', 'draft', 'archived');--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "utm_id" text;--> statement-breakpoint
ALTER TABLE "utm_presets" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "utm_presets" ADD COLUMN "utm_id" text;--> statement-breakpoint
ALTER TABLE "utm_presets" ADD COLUMN "custom_parameters" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "utm_presets" ADD COLUMN "status" "utm_template_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "utm_presets" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "utm_presets" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "utm_presets" ADD CONSTRAINT "utm_presets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "utm_presets_organization_status_idx" ON "utm_presets" USING btree ("organization_id","status");--> statement-breakpoint
ALTER TABLE "utm_presets" ADD CONSTRAINT "utm_presets_custom_parameters_check" CHECK (jsonb_typeof("utm_presets"."custom_parameters") = 'array');