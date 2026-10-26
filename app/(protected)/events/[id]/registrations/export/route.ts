import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { getEvent, listRegistrations, type EventRegistrationRow } from "@/modules/events";
import { buildRegistrationsCsv } from "../csv";
import { REVIEW_STATUS_LABELS, type ReviewStatus } from "../review-status";
import { getPrimaryAttendee, getRegistrationSourceLabel } from "../registrations-table-model";

// spec.md "Authorized Registration Export" — ADMIN only, scoped to the event's own organization.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) return new NextResponse(null, { status: 401 });
  if (!isAdmin(user.profile)) return new NextResponse(null, { status: 403 });

  const { id } = await params;
  const event = await getEvent(id, user.profile.organizationId);
  if (!event) return new NextResponse(null, { status: 404 });

  const status = new URL(request.url).searchParams.get("status") as EventRegistrationRow["status"] | null;
  const reviewStatusParam = new URL(request.url).searchParams.get("reviewStatus");
  const reviewStatus = reviewStatusParam && reviewStatusParam in REVIEW_STATUS_LABELS
    ? reviewStatusParam as ReviewStatus
    : undefined;
  const q = new URL(request.url).searchParams.get("q");
  const source = new URL(request.url).searchParams.get("source");
  const occupation = new URL(request.url).searchParams.get("occupation");
  const state = new URL(request.url).searchParams.get("state");
  const sort = new URL(request.url).searchParams.get("sort") ?? "recent";
  const registrations = await listRegistrations(id, user.profile.organizationId, {
    status: status ?? undefined,
    reviewStatus,
    q: q ?? undefined,
  });
  const filtered = registrations.filter((registration) => {
    const primary = getPrimaryAttendee(registration);
    return (
      (!source || getRegistrationSourceLabel(registration).toLowerCase() === source.toLowerCase()) &&
      (!occupation || primary?.occupation === occupation) &&
      (!state || primary?.state === state)
    );
  });
  filtered.sort((left, right) => {
    if (sort === "name") return (getPrimaryAttendee(left)?.fullName ?? "").localeCompare(getPrimaryAttendee(right)?.fullName ?? "", "es");
    if (sort === "company") return (getPrimaryAttendee(left)?.company ?? "").localeCompare(getPrimaryAttendee(right)?.company ?? "", "es");
    const difference = left.createdAt.getTime() - right.createdAt.getTime();
    return sort === "oldest" ? difference : -difference;
  });

  return new NextResponse(buildRegistrationsCsv(filtered), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="registros_${event.slug}.csv"`,
    },
  });
}
