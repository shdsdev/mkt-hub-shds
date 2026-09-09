import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { getLink } from "@/modules/links";
import {
  getScansForLinkGrouped,
  getDeviceBreakdownForLink,
  getCountryBreakdownForLink,
  getCityBreakdownForLink,
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

  const from = new Date(parsed.data.from);
  // A date-only "to" parses as that day's midnight — push it to the end of the day so events
  // from later that same day (the common case: "to" defaults to today) aren't excluded.
  const to = new Date(parsed.data.to);
  to.setUTCHours(23, 59, 59, 999);

  const [buckets, devices, countries, cities] = await Promise.all([
    getScansForLinkGrouped(linkId, parsed.data.granularity, from, to),
    getDeviceBreakdownForLink(linkId, from, to),
    getCountryBreakdownForLink(linkId, from, to),
    getCityBreakdownForLink(linkId, from, to),
  ]);

  return NextResponse.json({ buckets, devices, countries, cities });
}
