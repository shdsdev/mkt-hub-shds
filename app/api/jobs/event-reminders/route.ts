import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { listDueReminderAttendees } from "@/modules/events";
import { sendReminderEmail } from "@/modules/notifications";
import { exportQrPng } from "@/modules/qr";
import { resolveEventEmailContent } from "@/lib/events/event-email-content";

// design.md "Reminder trigger": external cron-job.org POSTs here (Vercel Hobby plan cannot cron
// more than daily, but hour-level reminderOffsetMinutes needs finer granularity). Safe to call
// more often than needed — `sendReminderEmail`'s `claimNotification` call is the exactly-once
// boundary, not this route; a repeated POST just re-lists the same due attendees and no-ops on
// every one already claimed. Bearer secret read through env.EVENTS_REMINDER_JOB_SECRET (which
// throws when unset) rather than raw `process.env`, unlike the out-of-scope `jobs/rollup` route.
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

  const due = await listDueReminderAttendees();
  const outcomes = await Promise.all(
    due.map(async ({ event, attendee, cancelToken }) => {
      try {
        const qrPng = await exportQrPng(attendee.backupCode, {});
        const result = await sendReminderEmail({
          organizationId: attendee.organizationId,
          attendeeId: attendee.id,
          to: attendee.email,
          attendeeName: attendee.fullName,
          eventName: event.name,
          backupCode: attendee.backupCode,
          qrPngBase64: qrPng.toString("base64"),
          eventStartsAt: event.startsAt,
          eventEndsAt: event.endsAt,
          eventLocation: event.location,
          eventLocationUrl: event.locationUrl,
          manageUrl: `${env.NEXT_PUBLIC_APP_ORIGIN}/events/cancel/${cancelToken}`,
          emailContent: resolveEventEmailContent(event.emailContent),
          agenda: event.agenda,
        });

        if (result.sent) return "sent" as const;
        if (result.reason === "already_sent") return "skipped" as const;
        console.error("[event-reminders] provider failure", { attendeeId: attendee.id, error: result.error });
        return "failed" as const;
      } catch (error) {
        console.error("[event-reminders] reminder processing failed", {
          attendeeId: attendee.id,
          error: error instanceof Error ? error.message : "Unknown reminder error",
        });
        return "failed" as const;
      }
    }),
  );

  const sent = outcomes.filter((outcome) => outcome === "sent").length;
  const skipped = outcomes.filter((outcome) => outcome === "skipped").length;
  const failed = outcomes.filter((outcome) => outcome === "failed").length;

  return NextResponse.json({ ok: failed === 0, processed: due.length, sent, skipped, failed });
}
