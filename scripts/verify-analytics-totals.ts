import "dotenv/config";
import {
  getAnalyticsTotalsForLink,
  getAnalyticsForLinkGrouped,
  utcDayBounds,
} from "@/modules/analytics";

const linkId = "ac8a3b1d-f06d-4274-9190-b146e5fa13a0";

async function main() {
  const { from, to } = utcDayBounds({ from: "2026-08-12", to: "2026-09-10" });
  const [buckets, totals] = await Promise.all([
    getAnalyticsForLinkGrouped(linkId, "qr_scan", "day", from, to),
    getAnalyticsTotalsForLink(linkId, "qr_scan", from, to),
  ]);

  const sum = buckets.reduce((s, b) => s + b.count, 0);
  console.log("buckets:", buckets.length);
  console.log("sum of buckets:", sum);
  console.log("totals:", totals);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
