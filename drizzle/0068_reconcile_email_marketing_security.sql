DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_delivery_events_recipient_id_email_campaign_recipients_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_delivery_events_recipient_id_email_campaign_recipients_id_fk'
  ) THEN
    ALTER TABLE "public"."email_delivery_events"
      RENAME CONSTRAINT "email_delivery_events_recipient_id_email_campaign_recipients_id"
      TO "email_delivery_events_recipient_id_email_campaign_recipients_id_fk";
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "public"."email_campaign_recipients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_contact_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_contact_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_delivery_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_repermission_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_segments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;
