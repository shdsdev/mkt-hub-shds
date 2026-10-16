import { describe, expect, it } from "vitest";
import { buildWhatsAppInvitationUrl, normalizePhoneForMessaging } from "./registration-contact-links";

describe("registration contact links", () => {
  it("normalizes a Mexican phone number for messaging", () => {
    expect(normalizePhoneForMessaging("+52 55 1234 5678")).toBe("525512345678");
  });

  it("builds a prefilled WhatsApp invitation", () => {
    const url = buildWhatsAppInvitationUrl({
      phone: "+52 55 1234 5678",
      attendeeName: "María González",
      eventName: "Workshop Shades",
      backupCode: "A7K4P2",
    });

    expect(url).toContain("https://wa.me/525512345678?text=");
    expect(decodeURIComponent(url)).toContain("María González");
    expect(decodeURIComponent(url)).toContain("A7K4P2");
  });
});
