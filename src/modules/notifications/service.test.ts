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
} from "./service";

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

const attendeeEmailInput = {
  organizationId: "org-1",
  attendeeId: "attendee-1",
  to: "attendee@example.com",
  attendeeName: "Jane Doe",
  eventName: "Launch Day",
  backupCode: "ABCD1234",
  qrPngBase64: "ZmFrZS1wbmc=",
};

describe("notifications service — claimNotification idempotency (design.md 'Reminder idempotency')", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims a notification by inserting a pending row and returning its id", async () => {
    insertMock.mockReturnValue(insertChain([{ id: "log-1" }]));

    const claim = await claimNotification({
      organizationId: "org-1",
      subjectType: "event_attendee",
      subjectId: "attendee-1",
      notificationType: "confirmation",
    });

    expect(claim).toEqual({ id: "log-1" });
    expect(insertMock).toHaveBeenCalledOnce();
  });

  it("returns no row for a duplicate claim on the same (subject_id, notification_type)", async () => {
    insertMock.mockReturnValue(insertChain([]));

    const claim = await claimNotification({
      organizationId: "org-1",
      subjectType: "event_attendee",
      subjectId: "attendee-1",
      notificationType: "confirmation",
    });

    expect(claim).toBeUndefined();
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
  });

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
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse((requestInit as RequestInit).body as string);
    expect(body.html).not.toContain("<script>alert(1)</script>");
    expect(body.html).not.toContain('"><img onerror=alert(1) src=x>');
    expect(body.html).toContain("&lt;script&gt;");
    expect(body.html).toContain("&quot;&gt;&lt;img onerror=alert(1) src=x&gt;");
  });

  it("rejects a qrPngBase64 payload that is not valid base64 instead of embedding it raw", async () => {
    insertMock.mockReturnValue(insertChain([{ id: "log-5" }]));

    await expect(
      sendConfirmationEmail({ ...attendeeEmailInput, qrPngBase64: '"><script>alert(1)</script>' }),
    ).rejects.toThrow(/not valid base64/);
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
