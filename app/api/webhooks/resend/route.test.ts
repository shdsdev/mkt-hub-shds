import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { RESEND_WEBHOOK_SECRET: "whsec_dGVzdC1zZWNyZXQ=" } }));
vi.mock("@/modules/email-marketing", () => ({ processResendWebhookEvent: vi.fn() }));

import { verifyResendWebhookSignature } from "./signature";

describe("Resend webhook signature verification", () => {
  it("accepts a valid current Svix signature", () => {
    const body = JSON.stringify({ type: "email.delivered" });
    const id = "msg_1";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", Buffer.from("test-secret"))
      .update(`${id}.${timestamp}.${body}`)
      .digest("base64");
    const headers = new Headers({
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${signature}`,
    });

    expect(verifyResendWebhookSignature(body, headers, "whsec_dGVzdC1zZWNyZXQ=", Date.now())).toBe(true);
  });

  it("rejects stale or invalid signatures", () => {
    const headers = new Headers({
      "svix-id": "msg_1",
      "svix-timestamp": String(Math.floor(Date.now() / 1000) - 600),
      "svix-signature": "v1,invalid",
    });

    expect(verifyResendWebhookSignature("{}", headers, "whsec_dGVzdC1zZWNyZXQ=", Date.now())).toBe(false);
  });
});
