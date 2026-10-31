-- Application tables are accessed through server-side Drizzle, not PostgREST.
-- Match 0014: no client policies, so RLS denies rows even if grants are restored.
SET LOCAL lock_timeout = '5s';
ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."question_duplicates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."question_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."question_question_topics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."question_topics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."question_votes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."question_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."telegram_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."monitoring_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_editors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_benefit_redemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_benefits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notification_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."theme_color_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_attendees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_receptionists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ga4_event_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."analytics_consents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."raffle_prizes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."raffles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."hcs_pairing_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."integration_idempotency_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."hcs_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."raffle_audit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."raffle_draws" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- RLS does not protect TRUNCATE; remove unnecessary client privileges as well.
-- Keep service_role and the backend database role unchanged.
REVOKE ALL PRIVILEGES ON TABLE
  "public"."questions",
  "public"."question_duplicates",
  "public"."question_participants",
  "public"."question_question_topics",
  "public"."question_topics",
  "public"."question_votes",
  "public"."question_sessions",
  "public"."user_notifications",
  "public"."telegram_settings",
  "public"."monitoring_settings",
  "public"."event_editors",
  "public"."event_benefit_redemptions",
  "public"."event_benefits",
  "public"."notification_log",
  "public"."theme_color_overrides",
  "public"."events",
  "public"."event_attendees",
  "public"."event_receptionists",
  "public"."event_registrations",
  "public"."ga4_event_outbox",
  "public"."analytics_consents",
  "public"."raffle_prizes",
  "public"."raffles",
  "public"."hcs_pairing_codes",
  "public"."integration_idempotency_records",
  "public"."hcs_connections",
  "public"."raffle_audit",
  "public"."raffle_draws"
FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
-- Public URLs do not need a SELECT policy. Retain owner SELECT for deletion,
-- without allowing anonymous or cross-owner enumeration of the bucket.
DROP POLICY IF EXISTS "event_landing_images_select_public" ON storage.objects;
CREATE POLICY "event_landing_images_select_owner" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'event-landing-images' AND owner = (SELECT auth.uid()));
--> statement-breakpoint
DROP POLICY IF EXISTS "qr_logos_select_public" ON storage.objects;
CREATE POLICY "qr_logos_select_owner" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'qr-logos' AND owner = (SELECT auth.uid()));
--> statement-breakpoint
DROP POLICY IF EXISTS "qr_placement_images_select_public" ON storage.objects;
CREATE POLICY "qr_placement_images_select_owner" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'qr-placement-images' AND owner = (SELECT auth.uid()));
