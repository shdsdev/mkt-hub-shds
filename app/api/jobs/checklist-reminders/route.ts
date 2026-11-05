import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { listDueChecklistReminders } from "@/modules/events";
import { createInternalNotifications } from "@/modules/notifications";

// External cron POSTs here with the same bearer secret as the event-reminders job. Safe to call
// repeatedly: createInternalNotifications dedupes per recipient + dedupeKey, so a task gets one
// in-app reminder for its due date even if the job runs many times that day.
export async function POST(request: NextRequest) {
  let secret: string;
  try {
    secret = env.EVENTS_REMINDER_JOB_SECRET;
  } catch {
    return new NextResponse("EVENTS_REMINDER_JOB_SECRET is not configured.", { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  const due = await listDueChecklistReminders();
  let notified = 0;
  let failed = 0;

  for (const task of due) {
    try {
      await createInternalNotifications({
        organizationId: task.organizationId,
        recipientUserIds: [task.assigneeId],
        subjectId: task.id,
        type: "checklist_task_due",
        title: `Tarea pendiente: ${task.title}`,
        body: `${task.eventName} · vence el ${task.dueDate}`,
        href: `/events/${task.eventId}/organization`,
        dedupeKey: `checklist-task:${task.id}:${task.dueDate}`,
      });
      notified += 1;
    } catch (error) {
      failed += 1;
      console.error("[checklist-reminders] notification failed", {
        taskId: task.id,
        error: error instanceof Error ? error.message : "Unknown reminder error",
      });
    }
  }

  return NextResponse.json({ ok: failed === 0, processed: due.length, notified, failed });
}
