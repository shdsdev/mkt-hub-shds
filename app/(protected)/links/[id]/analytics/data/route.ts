import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { getLink } from "@/modules/links";
import { getAnalyticsForLinkGrouped, getAnalyticsTotalsForLink, utcDayBounds } from "@/modules/analytics";

const querySchema = z.object({
  granularity: z.enum(["day", "week", "month"]),
  from: z.string().date(),
  to: z.string().date(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  const link = await getLink(id);
  if (!link || link.organizationId !== user.profile.organizationId) {
    return new NextResponse(null, { status: 404 });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const { from, to } = utcDayBounds(parsed.data);
  const [buckets, totals] = await Promise.all([
    getAnalyticsForLinkGrouped(id, "link_click", parsed.data.granularity, from, to),
    getAnalyticsTotalsForLink(id, "link_click", from, to),
  ]);

  return NextResponse.json({ buckets, totals });
}
