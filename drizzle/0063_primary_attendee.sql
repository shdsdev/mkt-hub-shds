ALTER TABLE "event_attendees" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "registration_id" ORDER BY "created_at", "id") = 1 AS "is_primary"
  FROM "event_attendees"
)
UPDATE "event_attendees" AS attendees
SET "is_primary" = ranked."is_primary"
FROM ranked
WHERE attendees."id" = ranked."id";--> statement-breakpoint
CREATE UNIQUE INDEX "event_attendees_registration_primary_unique" ON "event_attendees" USING btree ("registration_id") WHERE "event_attendees"."is_primary";--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'event_primary_transfer';
