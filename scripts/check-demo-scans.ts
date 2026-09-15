import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { trackingEvents, trackingRollupDaily } from "@/modules/analytics/db";

const linkId = "ac8a3b1d-f06d-4274-9190-b146e5fa13a0";

async function main() {
  const [rollupRow] = await db
    .select({ total: sql<number>`sum(${trackingRollupDaily.scansHuman})` })
    .from(trackingRollupDaily)
    .where(eq(trackingRollupDaily.linkId, linkId));

  const [eventsRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(trackingEvents)
    .where(and(eq(trackingEvents.linkId, linkId), eq(trackingEvents.sourceType, "qr_scan")));

  console.log("Rollup scansHuman total:", rollupRow.total ?? 0);
  console.log("Raw qr_scan events:", eventsRow.total ?? 0);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
