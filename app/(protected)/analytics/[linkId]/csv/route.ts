import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { getLink } from "@/modules/links";
import { exportRollupCsvForLink } from "@/modules/analytics";

export async function GET(
  _request: Request,
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

  const csv = await exportRollupCsvForLink(linkId);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="analytics-${linkId}.csv"`,
    },
  });
}
