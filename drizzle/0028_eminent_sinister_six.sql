UPDATE "events" SET "reminder_offset_minutes" = 2880 WHERE "reminder_offset_minutes" IS NULL;
ALTER TABLE "events" ALTER COLUMN "reminder_offset_minutes" SET DEFAULT 2880;
