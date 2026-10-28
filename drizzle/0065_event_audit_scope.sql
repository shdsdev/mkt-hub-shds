ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'event_primary_transfer';
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'event_change';
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'event_send';
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'event_send_failed';
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_actor_type') THEN
    CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'system');
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actor_type" "public"."audit_actor_type" DEFAULT 'user' NOT NULL;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "event_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.audit_logs'::regclass
      AND conname = 'audit_logs_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "public"."audit_logs" DROP CONSTRAINT "audit_logs_user_id_users_id_fk";
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.audit_logs'::regclass
      AND conname = 'audit_logs_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "public"."audit_logs"
      ADD CONSTRAINT "audit_logs_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_event_created_at_idx" ON "audit_logs" USING btree ("event_id","created_at");
