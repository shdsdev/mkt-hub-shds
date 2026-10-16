import { beforeEach, describe, it, expect, vi } from "vitest";

const { insertMock, updateMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { insert: insertMock, update: updateMock },
}));

// Isolated getters — `required()` throwing when unset is already covered by src/lib/env.test.ts;
// this test only needs stable configured values.
vi.mock("@/lib/env", () => ({
  env: {
    RESEND_API_KEY: "test-resend-key",
    RESEND_FROM: "events@example.com",
  },
}));

import {
  claimNotification,
  markNotificationSent,
  markNotificationFailed,
  sendConfirmationEmail,
  sendWaitlistPromotionEmail,
  sendReminderEmail,
  escapeHtml,
  formatEventDateEs,
  formatEventTimeRangeEs,
  buildGoogleMapsUrl,
} from "./service";
import { notificationLog } from "./db";

function insertChain(rows: unknown[]) {
  const chain = { values: vi.fn(), onConflictDoNothing: vi.fn(), returning: vi.fn() };
  chain.values.mockReturnValue(chain);
  chain.onConflictDoNothing.mockReturnValue(chain);
  chain.returning.mockResolvedValue(rows);
  return chain;
}

function updateChain() {
  const chain = { set: vi.fn(), where: vi.fn() };
  chain.set.mockReturnValue(chain);
  chain.where.mockResolvedValue(undefined);
  return chain;
}

// eventStartsAt/eventEndsAt are UTC instants that land on 09:00/15:00 in America/Mexico_City
// (UTC-6 year-round since Mexico abolished DST in most of the country) — the timezone the
// formatters render in, matching the GDL venue in the BMIGHTY templates.
const attendeeEmailInput = {
  organizationId: "org-1",
  attendeeId: "attendee-1",
  to: "attendee@example.com",
  attendeeName: "Jane Doe",
  eventName: "Launch Day",
  backupCode: "ABCD1234",
  qrPngBase64: "ZmFrZS1wbmc=",
  eventStartsAt: new Date("2026-11-06T15:00:00Z"),
  eventEndsAt: new Date("2026-11-06T21:00:00Z") as Date | null,
  eventLocation: "Hotel Victoria Ejecutivo Guadalajara" as string | null,
  eventLocationUrl: null as string | null,
  manageUrl: "https://shmx.men/events/cancel/cancel-token-1",
  emailContent: {
    version: 1 as const,
    confirmationIntro: "Tu acceso personalizado está listo.",
    reminderIntro: "Mañana nos encontramos en el evento.",
    logistics: "Llega 15 minutos antes y lleva tu identificación.",
    benefit: "Accede a beneficios exclusivos para asistentes.",
  },
  agenda: [{ time: "10:00", title: "Apertura", description: "Bienvenida" }],
};

describe("notifications service — claimNotification idempotency (design.md 'Reminder idempotency')", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims a notification by inserting a pending row with ON CONFLICT DO NOTHING on the exact unique-constraint columns, returning its id", async () => {
    const chain = insertChain([{ id: "log-1" }]);
    insertMock.mockReturnValue(chain);

    const claim = await claimNotification({
      organizationId: "org-1",
      subjectType: "event_attendee",
      subjectId: "attendee-1",
      notificationType: "confirmation",
    });

    expect(claim).toEqual({ id: "log-1" });
    expect(insertMock).toHaveBeenCalledOnce();
    // Pins the actual conflict target to notification_log's unique constraint columns
    // (subject_id, notification_type) — deleting the real `.onConflictDoNothing(...)` call from
    // production source, or pointing it at the wrong columns, fails this assertion even though the
    // insert/returning mock chain still resolves a row.
    expect(chain.onConflictDoNothing).toHaveBeenCalledWith({
      target: [notificationLog.subjectId, notificationLog.notificationType],
    });
  });

  it("returns no row for a duplicate claim on the same (subject_id, notification_type), still requesting the correct conflict target", async () => {
    const chain = insertChain([]);
    insertMock.mockReturnValue(chain);

    const claim = await claimNotification({
      organizationId: "org-1",
      subjectType: "event_attendee",
      subjectId: "attendee-1",
      notificationType: "confirmation",
    });

    expect(claim).toBeUndefined();
    expect(chain.onConflictDoNothing).toHaveBeenCalledWith({
      target: [notificationLog.subjectId, notificationLog.notificationType],
    });
  });
});

describe("notifications service — status transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks a notification sent with the provider message id", async () => {
    const chain = updateChain();
    updateMock.mockReturnValue(chain);

    await markNotificationSent("log-1", "resend-msg-1");

    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent", providerMessageId: "resend-msg-1" }),
    );
  });

  it("marks a notification failed with the error detail", async () => {
    const chain = updateChain();
    updateMock.mockReturnValue(chain);

    await markNotificationFailed("log-1", "Resend 500: boom");

    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", error: "Resend 500: boom" }),
    );
  });
});

describe("notifications service — send functions (spec.md 'notifications-email')", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("does not call the email provider when the notification was already claimed by another sender", async () => {
    insertMock.mockReturnValue(insertChain([]));

    const result = await sendConfirmationEmail(attendeeEmailInput);

    expect(result).toEqual({ sent: false, reason: "already_sent" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends the confirmation email and marks it sent on provider success", async () => {
    insertMock.mockReturnValue(insertChain([{ id: "log-1" }]));
    updateMock.mockReturnValue(updateChain());
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "resend-msg-1" }),
    });

    const result = await sendConfirmationEmail(attendeeEmailInput);

    expect(result).toEqual({ sent: true, notificationId: "log-1" });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-resend-key" }),
      }),
    );
    const [, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((requestInit as RequestInit).body as string);
    expect(body.html).toContain("cid:event-attendee-qr");
    expect(body.html).toContain("Tu acceso personalizado está listo.");
    expect(body.html).toContain("CANCELAR MI REGISTRO");
    expect(body.attachments).toEqual([
      expect.objectContaining({
        content: attendeeEmailInput.qrPngBase64,
        filename: "event-access-qr.png",
        content_id: "event-attendee-qr",
      }),
    ]);
  });

  it("prefers the direct Maps URL and escapes it in the email link", async () => {
    insertMock.mockReturnValue(insertChain([{ id: "log-direct" }]));
    updateMock.mockReturnValue(updateChain());
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ id: "resend-direct" }) });

    await sendConfirmationEmail({
      ...attendeeEmailInput,
      eventLocationUrl: "https://maps.example.test/place?a=1&b=2",
    });

    const [, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((requestInit as RequestInit).body as string);
    expect(body.html).toContain('href="https://maps.example.test/place?a=1&amp;b=2"');
    expect(body.html).not.toContain("google.com/maps/search");
    expect(body.html).toContain("Hotel Victoria Ejecutivo Guadalajara");
  });

  it("falls back to a generated Maps search URL for legacy events", async () => {
    insertMock.mockReturnValue(insertChain([{ id: "log-fallback" }]));
    updateMock.mockReturnValue(updateChain());
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ id: "resend-fallback" }) });

    await sendConfirmationEmail(attendeeEmailInput);

    const [, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((requestInit as RequestInit).body as string);
    expect(body.html).toContain('href="https://www.google.com/maps/search/?api=1&amp;query=Hotel%20Victoria%20Ejecutivo%20Guadalajara"');
  });

  it("falls back to a generated Maps search URL when the direct URL is blank", async () => {
    insertMock.mockReturnValue(insertChain([{ id: "log-blank-url" }]));
    updateMock.mockReturnValue(updateChain());
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ id: "resend-blank-url" }) });

    await sendConfirmationEmail({ ...attendeeEmailInput, eventLocationUrl: "  \t" });

    const [, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((requestInit as RequestInit).body as string);
    expect(body.html).toContain('href="https://www.google.com/maps/search/?api=1&amp;query=Hotel%20Victoria%20Ejecutivo%20Guadalajara"');
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"])(
    "falls back to a generated Maps search URL for persisted unsafe URL %s",
    async (eventLocationUrl) => {
      insertMock.mockReturnValue(insertChain([{ id: "log-unsafe-url" }]));
      updateMock.mockReturnValue(updateChain());
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ id: "resend-unsafe-url" }),
      });

      await sendConfirmationEmail({ ...attendeeEmailInput, eventLocationUrl });

      const [, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse((requestInit as RequestInit).body as string);
      expect(body.html).toContain(
        'href="https://www.google.com/maps/search/?api=1&amp;query=Hotel%20Victoria%20Ejecutivo%20Guadalajara"',
      );
      expect(body.html).not.toContain(eventLocationUrl);
    },
  );

  it("marks the notification failed and does not throw when the provider rejects the send", async () => {
    insertMock.mockReturnValue(insertChain([{ id: "log-1" }]));
    const chain = updateChain();
    updateMock.mockReturnValue(chain);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "invalid recipient",
    });

    const result = await sendConfirmationEmail(attendeeEmailInput);

    expect(result).toEqual({
      sent: false,
      reason: "provider_failure",
      error: "Resend 422: invalid recipient",
    });
    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("sends the waitlist promotion email with identical content shape to confirmation", async () => {
    insertMock.mockReturnValue(insertChain([{ id: "log-2" }]));
    updateMock.mockReturnValue(updateChain());
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "resend-msg-2" }),
    });

    const result = await sendWaitlistPromotionEmail(attendeeEmailInput);

    expect(result).toEqual({ sent: true, notificationId: "log-2" });
  });

  it("sends exactly one reminder email per registration and claims before dispatch", async () => {
    insertMock.mockReturnValue(insertChain([{ id: "log-3" }]));
    updateMock.mockReturnValue(updateChain());
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "resend-msg-3" }),
    });

    const result = await sendReminderEmail(attendeeEmailInput);

    expect(result).toEqual({ sent: true, notificationId: "log-3" });
    expect(insertMock).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("does not send a second reminder when already logged as sent", async () => {
    insertMock.mockReturnValue(insertChain([]));

    const result = await sendReminderEmail(attendeeEmailInput);

    expect(result).toEqual({ sent: false, reason: "already_sent" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("escapes a malicious attendee name instead of passing it through raw HTML", async () => {
    insertMock.mockReturnValue(insertChain([{ id: "log-4" }]));
    updateMock.mockReturnValue(updateChain());
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "resend-msg-4" }) });

    await sendConfirmationEmail({
      ...attendeeEmailInput,
      attendeeName: '<script>alert(1)</script>',
      eventName: '"><img onerror=alert(1) src=x>',
      eventLocation: "<img src=x onerror=alert(2)>",
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse((requestInit as RequestInit).body as string);
    expect(body.html).not.toContain("<script>alert(1)</script>");
    expect(body.html).not.toContain('"><img onerror=alert(1) src=x>');
    expect(body.html).not.toContain("<img src=x onerror=alert(2)>");
    expect(body.html).toContain("&lt;script&gt;");
    expect(body.html).toContain("&quot;&gt;&lt;img onerror=alert(1) src=x&gt;");
    expect(body.html).toContain("&lt;img src=x onerror=alert(2)&gt;");
  });

  // spec.md "Testing strategy" item 4 — direct proof the 48h reminder's HTML actually carries real,
  // correctly formatted event data, not just that sendReminderEmail was invoked.
  it("sendReminderEmail renders the 48h copy with the formatted date, time, maps link, and manage url", async () => {
    insertMock.mockReturnValue(insertChain([{ id: "log-6" }]));
    updateMock.mockReturnValue(updateChain());
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "resend-msg-6" }) });

    await sendReminderEmail(attendeeEmailInput);

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse((requestInit as RequestInit).body as string);
    expect(body.html).toContain("48 horas");
    expect(body.html).toContain("Viernes 6 de noviembre de 2026");
    expect(body.html).toContain("09:00 a 15:00 h");
    // '&' is HTML-escaped to '&amp;' here because this lands inside an href attribute — unlike
    // the raw-URL case covered by the standalone buildGoogleMapsUrl test above.
    expect(body.html).toContain(
      "https://www.google.com/maps/search/?api=1&amp;query=Hotel%20Victoria%20Ejecutivo%20Guadalajara",
    );
    expect(body.html).toContain(attendeeEmailInput.manageUrl);
    expect(body.html).toContain("Mañana nos encontramos en el evento.");
    expect(body.html).toContain("Accede a beneficios exclusivos para asistentes.");
  });

  it("rejects a qrPngBase64 payload that is not valid base64 instead of embedding it raw", async () => {
    insertMock.mockReturnValue(insertChain([{ id: "log-5" }]));

    await expect(
      sendConfirmationEmail({ ...attendeeEmailInput, qrPngBase64: '"><script>alert(1)</script>' }),
    ).rejects.toThrow(/not valid base64/);
  });
});

describe("formatEventDateEs", () => {
  it("formats a UTC instant as a Spanish long date in America/Mexico_City", () => {
    expect(formatEventDateEs(new Date("2026-11-06T15:00:00Z"))).toBe("Viernes 6 de noviembre de 2026");
  });
});

describe("formatEventTimeRangeEs", () => {
  it("formats a start/end pair as a 24h range in America/Mexico_City", () => {
    expect(
      formatEventTimeRangeEs(new Date("2026-11-06T15:00:00Z"), new Date("2026-11-06T21:00:00Z")),
    ).toBe("09:00 a 15:00 h");
  });

  it("falls back to just the start time when there is no end time", () => {
    expect(formatEventTimeRangeEs(new Date("2026-11-06T15:00:00Z"), null)).toBe("09:00 h");
  });
});

describe("buildGoogleMapsUrl", () => {
  it("builds a Maps search URL with the location URL-encoded", () => {
    expect(buildGoogleMapsUrl("Hotel Victoria Ejecutivo Guadalajara")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Hotel%20Victoria%20Ejecutivo%20Guadalajara",
    );
  });
});

describe("escapeHtml", () => {
  it("escapes every HTML-special character", () => {
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeHtml("Jane Doe")).toBe("Jane Doe");
  });
});
