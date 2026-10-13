import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { getEvent, listRegistrations, type EventRegistrationRow } from "@/modules/events";
import { buildRegistrationsCsv } from "../csv";

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
  const q = new URL(request.url).searchParams.get("q");
  const registrations = await listRegistrations(id, user.profile.organizationId, {
    status: status ?? undefined,
    q: q ?? undefined,
  });

  return new NextResponse(buildRegistrationsCsv(registrations), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="registros_${event.slug}.csv"`,
    },
  });
}
