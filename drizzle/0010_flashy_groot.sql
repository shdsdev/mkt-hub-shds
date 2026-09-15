CREATE TYPE "public"."qr_static_kind" AS ENUM('text', 'vcard', 'email', 'sms', 'wifi');--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "default_logo_url" text;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "name" text;--> statement-breakpoint
UPDATE "qr_codes" SET "name" = COALESCE(NULLIF("static_payload", ''), 'QR sin nombre') WHERE "name" IS NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "static_kind" "qr_static_kind";--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "placement_image_url" text;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Placement photo (where the QR is deployed — flyer/magazine/catalog), distinct from qr-logos
-- (embedded inside the QR). Same public/policy shape as qr-logos (0004_slippery_morlocks.sql),
-- larger size limit since this holds real photographs, not small embedded logos.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('qr-placement-images', 'qr-placement-images', true, 5242880, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
CREATE POLICY "qr_placement_images_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'qr-placement-images');
--> statement-breakpoint
CREATE POLICY "qr_placement_images_select_public" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'qr-placement-images');
--> statement-breakpoint
CREATE POLICY "qr_placement_images_delete_owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'qr-placement-images' AND owner = auth.uid());