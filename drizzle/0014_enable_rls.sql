-- Row Level Security (2026-09-15) — previously deferred per DATABASE.md's "Multi-Tenancy" note
-- ("No Row-Level Security... in MVP"). Enabling it now with NO policies is a deliberate,
-- non-breaking hardening step: every table's actual access control still lives in the app layer
-- (organization_id filtering + getCurrentUser()), reached through Drizzle over a direct Postgres
-- connection — a role that bypasses RLS entirely. What this blocks is the OTHER path into the
-- same database: Supabase's auto-generated PostgREST data API, reachable with the anon/
-- authenticated keys any Supabase client library uses. This app doesn't use that API for data
-- access (only Auth + Storage), so RLS-with-no-policies simply closes a door nothing here opens.
-- If that ever changes, add real policies before anything starts using the anon/authenticated key
-- for table access — until then, enabling RLS alone is strictly a lockdown, not a functional gap.
ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."domains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."folders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."link_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."short_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."qr_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."campaign_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tracking_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tracking_events_2026_09" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."utm_presets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."print_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tracking_rollup_daily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."qr_design_templates" ENABLE ROW LEVEL SECURITY;
