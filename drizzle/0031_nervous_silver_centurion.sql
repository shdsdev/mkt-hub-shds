CREATE TABLE "hcs_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"hcs_company_id" text NOT NULL,
	"hcs_company_name" text NOT NULL,
	"access_token_hash" text NOT NULL,
	"access_token_prefix" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hcs_connections_organization_company_unique" UNIQUE("organization_id","hcs_company_id")
);
--> statement-breakpoint
CREATE TABLE "hcs_pairing_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_idempotency_connection_operation_key_unique" UNIQUE("connection_id","operation","key")
);
--> statement-breakpoint
ALTER TABLE "hcs_connections" ADD CONSTRAINT "hcs_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hcs_pairing_codes" ADD CONSTRAINT "hcs_pairing_codes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_idempotency_records" ADD CONSTRAINT "integration_idempotency_records_connection_id_hcs_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."hcs_connections"("id") ON DELETE no action ON UPDATE no action;
