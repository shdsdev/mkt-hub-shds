import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { getAnalyticsSource, getOrgRegionBreakdown, utcDayBounds } from "@/modules/analytics";

const querySchema = z.object({
  surface: z.enum(["qr", "links"]),
  country: z.string().min(1).max(10),
  from: z.string().date(),
  to: z.string().date(),
});

// Lazy, per-country sibling of /analytics/data — the location table fetches this only when a
// country row is expanded, not bundled into the main dashboard payload.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse(null, { status: 401 });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
  }

  const eventType = getAnalyticsSource(parsed.data.surface).eventType;
  const { from, to } = utcDayBounds({ from: parsed.data.from, to: parsed.data.to });
  const regions = await getOrgRegionBreakdown(
    user.profile.organizationId,
    eventType,
    parsed.data.country,
    from,
    to,
  );

  return NextResponse.json({ regions });
}
