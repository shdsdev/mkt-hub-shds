CREATE TABLE "email_contact_tags" (
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_contact_tags_contact_tag_unique" UNIQUE("contact_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "email_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_tags_organization_name_unique" UNIQUE("organization_id","name_normalized")
);
--> statement-breakpoint
ALTER TABLE "email_contact_tags" ADD CONSTRAINT "email_contact_tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_contact_tags" ADD CONSTRAINT "email_contact_tags_contact_id_email_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."email_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_contact_tags" ADD CONSTRAINT "email_contact_tags_tag_id_email_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."email_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_tags" ADD CONSTRAINT "email_tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;