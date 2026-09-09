CREATE TABLE "print_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"qr_code_id" uuid,
	"short_link_id" uuid,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "print_run_target_check" CHECK (("print_runs"."qr_code_id" IS NOT NULL AND "print_runs"."short_link_id" IS NULL)
       OR ("print_runs"."qr_code_id" IS NULL AND "print_runs"."short_link_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "print_runs" ADD CONSTRAINT "print_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_runs" ADD CONSTRAINT "print_runs_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_runs" ADD CONSTRAINT "print_runs_short_link_id_short_links_id_fk" FOREIGN KEY ("short_link_id") REFERENCES "public"."short_links"("id") ON DELETE no action ON UPDATE no action;