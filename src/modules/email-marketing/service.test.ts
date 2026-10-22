import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

import {
  normalizeContactEmail,
  preserveContactStatus,
  resolveInitialContactStatus,
} from "./service";

describe("email marketing contact policy", () => {
  it("normalizes email addresses for organization-scoped identity", () => {
    expect(normalizeContactEmail("  Customer@Example.COM ")).toBe("customer@example.com");
  });

  it("rejects invalid email addresses", () => {
    expect(() => normalizeContactEmail("not-an-email")).toThrow();
  });

  it("subscribes a contact when registration includes marketing consent", () => {
    expect(resolveInitialContactStatus(new Date("2026-10-22T10:00:00.000Z"))).toBe("subscribed");
  });

  it("keeps a contact pending without marketing consent", () => {
    expect(resolveInitialContactStatus(undefined)).toBe("pending");
  });

  it("never silently re-subscribes an unsubscribed contact", () => {
    expect(
      preserveContactStatus("unsubscribed", new Date("2026-10-22T10:00:00.000Z")),
    ).toBe("unsubscribed");
  });

  it("never silently re-subscribes a suppressed contact", () => {
    expect(
      preserveContactStatus("suppressed", new Date("2026-10-22T10:00:00.000Z")),
    ).toBe("suppressed");
  });
});
