import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { getLink } from "@/modules/links";
import {
  getAnalyticsBreakdownsForLink,
  getAnalyticsForLinkGrouped,
  getAnalyticsTotalsForLink,
  utcDayBounds,
} from "@/modules/analytics";

const querySchema = z.object({
  granularity: z.enum(["day", "week", "month"]),
  from: z.string().date(),
  to: z.string().date(),
});

// Backs the scans panel's range/granularity controls — a client-side fetch, not a full page
// reload, since those controls change often while the page itself stays put.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse(null, { status: 401 });
  }

  const { linkId } = await params;
  const link = await getLink(linkId);
  if (!link || link.organizationId !== user.profile.organizationId) {
    return new NextResponse(null, { status: 404 });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
  }

  const range = { from: parsed.data.from, to: parsed.data.to };
  const { from, to } = utcDayBounds(range);

  const [buckets, breakdowns, totals] = await Promise.all([
    getAnalyticsForLinkGrouped(linkId, "qr_scan", parsed.data.granularity, from, to),
    getAnalyticsBreakdownsForLink(linkId, "qr_scan", from, to),
    getAnalyticsTotalsForLink(linkId, "qr_scan", from, to),
  ]);

  return NextResponse.json({ buckets, ...breakdowns, totals });
}
