CREATE TYPE "public"."qr_error_correction_level" AS ENUM('L', 'M', 'Q', 'H');--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "background_color" text DEFAULT '#1c130f' NOT NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "foreground_color" text DEFAULT '#f7eeeb' NOT NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "error_correction_level" "qr_error_correction_level" DEFAULT 'M' NOT NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "logo_url" text;--> statement-breakpoint
-- First real use of Supabase Storage in this project (ADR-005). Public bucket (QR logos are
-- meant to be publicly viewable — they're embedded in a public-facing QR image), path-scoped by
-- organization_id/qr_code_id at upload time by the app, not enforced by a storage.objects path
-- policy here (would require a subquery into public.users on every access).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('qr-logos', 'qr-logos', true, 2097152, ARRAY['image/png','image/jpeg','image/svg+xml','image/webp'])
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
CREATE POLICY "qr_logos_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'qr-logos');
--> statement-breakpoint
CREATE POLICY "qr_logos_select_public" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'qr-logos');
--> statement-breakpoint
CREATE POLICY "qr_logos_delete_owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'qr-logos' AND owner = auth.uid());