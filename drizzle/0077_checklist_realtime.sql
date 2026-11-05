-- Realtime for the event checklist. The browser subscribes directly through
-- Supabase Realtime, so these tables need REPLICA IDENTITY FULL (to filter
-- DELETE payloads by event_id) and SELECT policies for active organization
-- members with access to the event. Without policies, RLS stays deny-all and
-- Realtime would never deliver a row.

ALTER TABLE "public"."event_checklist_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_checklist_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_checklist_comments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."event_checklist_groups" REPLICA IDENTITY FULL;
ALTER TABLE "public"."event_checklist_tasks" REPLICA IDENTITY FULL;
ALTER TABLE "public"."event_checklist_comments" REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "event_checklist_groups_select" ON "public"."event_checklist_groups";
CREATE POLICY "event_checklist_groups_select" ON "public"."event_checklist_groups"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."users" u
      JOIN "public"."events" e ON e.id = "public"."event_checklist_groups"."event_id"
      WHERE u.id = auth.uid()
        AND u.status = 'active'
        AND u.organization_id = "public"."event_checklist_groups"."organization_id"
        AND e.organization_id = u.organization_id
        AND (
          u.role = 'ADMIN'
          OR EXISTS (
            SELECT 1 FROM "public"."event_editors" ee
            WHERE ee.event_id = "public"."event_checklist_groups"."event_id" AND ee.user_id = u.id
          )
          OR EXISTS (
            SELECT 1 FROM "public"."event_receptionists" er
            WHERE er.event_id = "public"."event_checklist_groups"."event_id" AND er.user_id = u.id
          )
        )
    )
  );

DROP POLICY IF EXISTS "event_checklist_tasks_select" ON "public"."event_checklist_tasks";
CREATE POLICY "event_checklist_tasks_select" ON "public"."event_checklist_tasks"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."users" u
      JOIN "public"."events" e ON e.id = "public"."event_checklist_tasks"."event_id"
      WHERE u.id = auth.uid()
        AND u.status = 'active'
        AND u.organization_id = "public"."event_checklist_tasks"."organization_id"
        AND e.organization_id = u.organization_id
        AND (
          u.role = 'ADMIN'
          OR EXISTS (
            SELECT 1 FROM "public"."event_editors" ee
            WHERE ee.event_id = "public"."event_checklist_tasks"."event_id" AND ee.user_id = u.id
          )
          OR EXISTS (
            SELECT 1 FROM "public"."event_receptionists" er
            WHERE er.event_id = "public"."event_checklist_tasks"."event_id" AND er.user_id = u.id
          )
        )
    )
  );

DROP POLICY IF EXISTS "event_checklist_comments_select" ON "public"."event_checklist_comments";
CREATE POLICY "event_checklist_comments_select" ON "public"."event_checklist_comments"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."users" u
      JOIN "public"."events" e ON e.id = "public"."event_checklist_comments"."event_id"
      WHERE u.id = auth.uid()
        AND u.status = 'active'
        AND u.organization_id = "public"."event_checklist_comments"."organization_id"
        AND e.organization_id = u.organization_id
        AND (
          u.role = 'ADMIN'
          OR EXISTS (
            SELECT 1 FROM "public"."event_editors" ee
            WHERE ee.event_id = "public"."event_checklist_comments"."event_id" AND ee.user_id = u.id
          )
          OR EXISTS (
            SELECT 1 FROM "public"."event_receptionists" er
            WHERE er.event_id = "public"."event_checklist_comments"."event_id" AND er.user_id = u.id
          )
        )
    )
  );

-- Add the tables to Supabase's realtime publication when it exists. Local
-- Postgres databases and CI do not have it, so each check stays guarded.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_checklist_groups'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.event_checklist_groups';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_checklist_tasks'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.event_checklist_tasks';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_checklist_comments'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.event_checklist_comments';
    END IF;
  END IF;
END $$;
