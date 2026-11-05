import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { canAccessEvent, getEvent, listEventAssignees, listEventChecklist } from "@/modules/events";
import { isActive } from "@/modules/users";
import { buildChecklistCsv } from "../csv";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  const event = await getEvent(id, user.profile.organizationId);
  if (!event) return new NextResponse(null, { status: 404 });
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId: event.id, capability: "organization" }))) {
    return new NextResponse(null, { status: 403 });
  }

  const [groups, assignees] = await Promise.all([
    listEventChecklist(event.id, user.profile.organizationId),
    listEventAssignees(event.id, user.profile.organizationId),
  ]);

  return new NextResponse(buildChecklistCsv(groups, assignees), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="organizacion_${event.slug}.csv"`,
    },
  });
}
