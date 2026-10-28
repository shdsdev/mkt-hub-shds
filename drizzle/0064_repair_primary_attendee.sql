DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_attendees'
      AND column_name = 'is_primary'
  ) THEN
    ALTER TABLE "event_attendees" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;

    WITH ranked AS (
      SELECT "id", row_number() OVER (PARTITION BY "registration_id" ORDER BY "created_at", "id") = 1 AS "is_primary"
      FROM "event_attendees"
    )
    UPDATE "event_attendees" AS attendees
    SET "is_primary" = ranked."is_primary"
    FROM ranked
    WHERE attendees."id" = ranked."id";
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_attendees_registration_primary_unique"
  ON "event_attendees" USING btree ("registration_id")
  WHERE "event_attendees"."is_primary";
--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'event_primary_transfer';
