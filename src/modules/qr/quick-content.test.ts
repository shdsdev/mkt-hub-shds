import { describe, expect, it } from "vitest";
import { buildQuickPayload, quickContentSchema } from "@/lib/quick-qr-content";

describe("quick QR content", () => {
  it("builds a WhatsApp payload from an international number", () => {
    expect(
      buildQuickPayload({ kind: "whatsapp", number: "+52 33 1234 5678", message: "Hola, Javier" }),
    ).toBe("https://wa.me/523312345678?text=Hola%2C%20Javier");
  });

  it("builds a vCard with an optional address", () => {
    expect(
      buildQuickPayload({
        kind: "vcard",
        fullName: "Ana, López",
        phone: "+52 33 1234 5678",
        email: "ana@example.com",
        address: "Av. México 100; Guadalajara",
      }),
    ).toContain("ADR:;;Av. México 100\\; Guadalajara;;;");
  });

  it("requires URLs to use http or https", () => {
    expect(quickContentSchema.safeParse({ kind: "url", value: "example.com" }).success).toBe(false);
    expect(quickContentSchema.safeParse({ kind: "url", value: "https://example.com" }).success).toBe(true);
  });

  it("requires international phone numbers without assuming a country", () => {
    expect(quickContentSchema.safeParse({ kind: "phone", number: "3312345678" }).success).toBe(false);
    expect(quickContentSchema.safeParse({ kind: "phone", number: "+52 33 1234 5678" }).success).toBe(true);
  });

  it("allows an open WiFi network without a password", () => {
    expect(
      quickContentSchema.safeParse({ kind: "wifi", ssid: "Guest", password: "", security: "nopass", hidden: false }).success,
    ).toBe(true);
  });
});
