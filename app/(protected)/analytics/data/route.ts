import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import {
  getAnalyticsSource,
  getOrgTrendGrouped,
  getOrgTotals,
  getOrgBestDay,
  getOrgBestLocation,
  getOrgBreakdowns,
  previousPeriod,
  utcDayBounds,
} from "@/modules/analytics";

const querySchema = z.object({
  surface: z.enum(["qr", "links"]),
  granularity: z.enum(["day", "week", "month"]),
  from: z.string().date(),
  to: z.string().date(),
});

// Backs the org-wide Analytics dashboard's source selector and date-range controls — org-scoped
// sibling of app/(protected)/analytics/[linkId]/data/route.ts, same query-param shape plus
// `surface` to pick which event type every widget reads.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse(null, { status: 401 });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
  }

  const orgId = user.profile.organizationId;
  const eventType = getAnalyticsSource(parsed.data.surface).eventType;
  const range = { from: parsed.data.from, to: parsed.data.to };
  const { from, to } = utcDayBounds(range);
  const { from: prevFrom, to: prevTo } = utcDayBounds(previousPeriod(range));

  const [trend, previousTrend, totals, bestDay, bestLocation, breakdowns] = await Promise.all([
    getOrgTrendGrouped(orgId, eventType, parsed.data.granularity, from, to),
    // Same granularity/span as `trend`, so both arrays line up index-for-index for the trend
    // chart's current-vs-previous overlay without any date-alignment logic on the client.
    getOrgTrendGrouped(orgId, eventType, parsed.data.granularity, prevFrom, prevTo),
    getOrgTotals(orgId, eventType, range),
    getOrgBestDay(orgId, eventType, range),
    getOrgBestLocation(orgId, eventType, range),
    getOrgBreakdowns(orgId, eventType, from, to),
  ]);

  return NextResponse.json({ trend, previousTrend, totals, bestDay, bestLocation, ...breakdowns });
}
