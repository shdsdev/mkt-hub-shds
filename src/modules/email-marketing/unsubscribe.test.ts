import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({
  env: {
    MARKETING_HUB_SERVER_TOKEN: "test-server-token",
    NEXT_PUBLIC_APP_ORIGIN: "https://shmx.men/",
  },
}));

import {
  buildUnsubscribeHeaders,
  buildUnsubscribeUrl,
  createUnsubscribeToken,
  decodeUnsubscribeToken,
} from "./service";

describe("email unsubscribe tokens", () => {
  it("round-trips an opaque token without exposing the contact ids", () => {
    const token = createUnsubscribeToken({ organizationId: "org-1", contactId: "contact-1" });

    expect(token).not.toContain("org-1");
    expect(token).not.toContain("contact-1");
    expect(decodeUnsubscribeToken(token)).toEqual({ organizationId: "org-1", contactId: "contact-1" });
  });

  it("rejects tampered tokens", () => {
    const token = createUnsubscribeToken({ organizationId: "org-1", contactId: "contact-1" });
    expect(decodeUnsubscribeToken(`${token}tampered`)).toBeNull();
  });

  it("builds the public one-click unsubscribe headers", () => {
    const url = buildUnsubscribeUrl("token-1");
    expect(url).toBe("https://shmx.men/email/unsubscribe/token-1");
    expect(buildUnsubscribeHeaders(url)).toEqual({
      "List-Unsubscribe": "<https://shmx.men/email/unsubscribe/token-1>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
});
