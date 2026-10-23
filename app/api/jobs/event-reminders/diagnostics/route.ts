import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { listDueReminderAttendees } from "@/modules/events";
import { listReminderNotificationStatuses, summarizeReminderStatuses } from "@/modules/notifications";

export async function GET(request: NextRequest) {
  let secret: string;
  try {
    secret = env.EVENTS_REMINDER_JOB_SECRET;
  } catch {
    return new NextResponse("EVENTS_REMINDER_JOB_SECRET is not configured.", { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  const due = await listDueReminderAttendees();
  const attendeeIds = due.map(({ attendee }) => attendee.id);
  const storedStatuses = await listReminderNotificationStatuses(attendeeIds);
  const statusByAttendeeId = new Map(storedStatuses.map((entry) => [entry.attendeeId, entry.status]));
  const summary = summarizeReminderStatuses(
    attendeeIds.map((attendeeId) => ({ attendeeId, status: statusByAttendeeId.get(attendeeId) })),
  );

  return NextResponse.json({ ok: true, reminders: summary });
}
