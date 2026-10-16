import { describe, expect, it } from "vitest";
import { getDefaultEventEmailContent, resolveEventEmailContent } from "./event-email-content";

describe("event email content", () => {
  it("provides editable defaults for confirmation and reminder emails", () => {
    const content = getDefaultEventEmailContent();

    expect(content).toMatchObject({
      version: 1,
      confirmationIntro: expect.any(String),
      reminderIntro: expect.any(String),
      logistics: expect.any(String),
      benefit: expect.any(String),
    });
  });

  it("falls back safely when stored email content is invalid", () => {
    expect(resolveEventEmailContent({ unexpected: true })).toEqual(getDefaultEventEmailContent());
  });
});
