CREATE TYPE "public"."qr_corner_type" AS ENUM('square', 'dot', 'rounded', 'dots', 'classy', 'classy-rounded', 'extra-rounded');--> statement-breakpoint
CREATE TYPE "public"."qr_shape_type" AS ENUM('square', 'rounded', 'dots', 'classy', 'classy-rounded', 'extra-rounded');--> statement-breakpoint
CREATE TABLE "qr_design_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"dots_type" "qr_shape_type" NOT NULL,
	"corners_square_type" "qr_corner_type" NOT NULL,
	"corners_dot_type" "qr_corner_type" NOT NULL,
	"background_color" text NOT NULL,
	"foreground_color" text NOT NULL,
	"error_correction_level" "qr_error_correction_level" NOT NULL,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "dots_type" "qr_shape_type" DEFAULT 'square' NOT NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "corners_square_type" "qr_corner_type" DEFAULT 'square' NOT NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "corners_dot_type" "qr_corner_type" DEFAULT 'square' NOT NULL;--> statement-breakpoint
ALTER TABLE "qr_design_templates" ADD CONSTRAINT "qr_design_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;