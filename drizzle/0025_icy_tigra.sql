CREATE TYPE "public"."theme_color_override_token" AS ENUM('primary', 'accent', 'background');--> statement-breakpoint
CREATE TABLE "theme_color_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"theme_id" text NOT NULL,
	"token" "theme_color_override_token" NOT NULL,
	"hex" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "theme_color_overrides_theme_token_unique" UNIQUE("theme_id","token")
);
--> statement-breakpoint
ALTER TABLE "theme_color_overrides" ADD CONSTRAINT "theme_color_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;