ALTER TABLE "events" ADD COLUMN "hero_image_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "agenda" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "sponsor_logos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_agenda_is_array" CHECK (jsonb_typeof("events"."agenda") = 'array');--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_sponsor_logos_is_array" CHECK (jsonb_typeof("events"."sponsor_logos") = 'array');
--> statement-breakpoint
-- Event landing imagery (hero image + sponsor logos) — same public/policy shape as
-- qr-placement-images (0010_flashy_groot.sql), one shared bucket since both are small,
-- admin-uploaded, publicly-readable images for the same public landing page.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-landing-images', 'event-landing-images', true, 5242880, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
CREATE POLICY "event_landing_images_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-landing-images');
--> statement-breakpoint
CREATE POLICY "event_landing_images_select_public" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'event-landing-images');
--> statement-breakpoint
CREATE POLICY "event_landing_images_delete_owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'event-landing-images' AND owner = auth.uid());