ALTER TABLE "event_registrations" ADD COLUMN "first_approved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "deletion_protected" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Only demonstrably untouched public new/pending registrations are legacy-deletable.
-- Any review, mutation, inactive/check-in attendee, audit, benefit or raffle history makes
-- prior approval ambiguous. Rejected/waitlisted/cancelled legacy rows remain protected.
-- Do not invent a first approval timestamp for legacy rows: protection carries the uncertainty.
UPDATE "event_registrations" r SET "deletion_protected" = true
WHERE NOT (
  r.source = 'public' AND r.status = 'pending_review' AND r.review_status = 'new'
  AND r.reviewed_at IS NULL AND r.reviewed_by IS NULL AND r.updated_at = r.created_at
  AND NOT EXISTS (SELECT 1 FROM event_attendees a WHERE a.registration_id = r.id
    AND (a.checked_in_at IS NOT NULL OR a.checked_in_by IS NOT NULL OR NOT a.is_active OR a.updated_at <> a.created_at))
  AND NOT EXISTS (SELECT 1 FROM audit_logs l WHERE l.resource_id = r.id
    OR l.resource_id IN (SELECT id FROM event_attendees WHERE registration_id = r.id))
  AND NOT EXISTS (SELECT 1 FROM event_benefit_redemptions b WHERE b.registration_id = r.id
    OR b.attendee_id IN (SELECT id FROM event_attendees WHERE registration_id = r.id))
  AND NOT EXISTS (SELECT 1 FROM raffle_draws d WHERE
    d.attendee_id IN (SELECT id FROM event_attendees WHERE registration_id = r.id)
    OR EXISTS (SELECT 1 FROM event_attendees a WHERE a.registration_id = r.id AND d.eligible_attendee_ids ? a.id::text))
);
--> statement-breakpoint
-- Also enforce sticky history for other SQL writers, not just the review service.
CREATE FUNCTION preserve_registration_deletion_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.first_approved_at := COALESCE(OLD.first_approved_at, NEW.first_approved_at);
    NEW.deletion_protected := OLD.deletion_protected OR NEW.deletion_protected;
  END IF;
  IF NEW.review_status = 'approved' OR NEW.status = 'confirmed' THEN
    NEW.first_approved_at := COALESCE(NEW.first_approved_at, CURRENT_TIMESTAMP);
  END IF;
  IF NEW.status = 'checked_in' THEN
    NEW.deletion_protected := true;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER event_registration_deletion_guard BEFORE INSERT OR UPDATE ON event_registrations
FOR EACH ROW EXECUTE FUNCTION preserve_registration_deletion_guard();
