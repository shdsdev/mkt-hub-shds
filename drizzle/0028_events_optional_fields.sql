-- Additive migration for the events-module (PR2 remediation — spec.md "Fixed Optional Field
-- Catalog"). Hand-authored for the same reason as `drizzle/0027_events_module.sql`: the
-- `drizzle/meta/_journal.json`/snapshot chain has pre-existing drift (see PR1/PR2 apply-progress)
-- that makes a raw `drizzle-kit generate` unsafe right now. This file contains ONLY the two new
-- boolean columns a clean diff against the current `events` table definition in schema.ts would
-- produce.
ALTER TABLE "events" ADD COLUMN "collect_company" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "collect_job_title" boolean DEFAULT false NOT NULL;
