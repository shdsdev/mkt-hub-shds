import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { links } from "@/modules/links/db";
import { trackingEvents, trackingRollupDaily } from "@/modules/analytics/db";


const linkId = "ac8a3b1d-f06d-4274-9190-b146e5fa13a0";

function deterministicCounts(days: number, target: number): number[] {
  const base = Math.floor(target / days);
  const remainder = target - base * days;
  const counts = Array.from({ length: days }, () => base);
  // Distribute remainder across the range in a wave pattern
  for (let i = 0; i < remainder; i++) {
    const index = Math.floor((i / remainder) * (days - 1));
    counts[index]++;
  }
  // Add small wave so the chart is not flat
  for (let i = 0; i < days; i++) {
    const wave = Math.round(Math.sin(i * 0.8) * 2);
    counts[i] = Math.max(1, counts[i] + wave);
  }
  // Rebalance to keep exact target
  const current = counts.reduce((s, c) => s + c, 0);
  let diff = target - current;
  let idx = 0;
  while (diff !== 0) {
    if (diff > 0) {
      counts[idx % days]++;
      diff--;
    } else {
      const i = idx % days;
      if (counts[i] > 1) {
        counts[i]--;
        diff++;
      }
    }
    idx++;
  }
  return counts;
}

async function main() {
  const [link] = await db.select({ organizationId: links.organizationId }).from(links).where(eq(links.id, linkId));
  if (!link) throw new Error(`Link not found: ${linkId}`);

  // Clean previous demo data for this link so counts are predictable
  await db.delete(trackingEvents).where(and(eq(trackingEvents.linkId, linkId), eq(trackingEvents.sourceType, "qr_scan")));
  await db.delete(trackingRollupDaily).where(eq(trackingRollupDaily.linkId, linkId));

  const start = new Date("2026-08-12T00:00:00.000Z");
  const days = 30;
  const targetTotal = 109;
  const counts = deterministicCounts(days, targetTotal);

  // Insert daily rollups directly. We skip raw events because tracking_events
  // is partitioned by month and the demo dates may not have partitions created.
  const rollups = [];
  for (let i = 0; i < days; i++) {
    const bucketDate = new Date(start);
    bucketDate.setUTCDate(bucketDate.getUTCDate() + i);
    rollups.push({
      organizationId: link.organizationId,
      linkId,
      date: bucketDate.toISOString().slice(0, 10),
      scansHuman: counts[i],
      clicksHuman: 0,
      scansBot: 0,
      clicksBot: 0,
    });
  }

  await db.insert(trackingRollupDaily).values(rollups);

  console.log(`Seeded ${rollups.length} demo QR rollup rows (total ${targetTotal} scans) for link ${linkId}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
