-- Keep the current month's tracking events writable and prevent future months from
-- failing inserts before their dedicated partitions are created.
CREATE TABLE "tracking_events_2026_10" PARTITION OF "tracking_events"
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE "tracking_events_default" PARTITION OF "tracking_events" DEFAULT;

ALTER TABLE "public"."tracking_events_2026_10" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tracking_events_default" ENABLE ROW LEVEL SECURITY;
