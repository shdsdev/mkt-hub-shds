import { describe, it, expect } from "vitest";
import { buildStaticPayload } from "./static-payload";

describe("buildStaticPayload", () => {
  it("returns text content verbatim", () => {
    expect(buildStaticPayload({ kind: "text", content: "hola mundo" })).toBe("hola mundo");
  });

  describe("vcard", () => {
    it("includes every field when all are provided", () => {
      const payload = buildStaticPayload({
        kind: "vcard",
        fullName: "Ana Pérez",
        phone: "+52 55 1234 5678",
        email: "ana@example.com",
        company: "Shades",
        website: "https://shades.example",
      });
      expect(payload).toBe(
        [
          "BEGIN:VCARD",
          "VERSION:3.0",
          "FN:Ana Pérez",
          "TEL:+52 55 1234 5678",
          "EMAIL:ana@example.com",
          "ORG:Shades",
          "URL:https://shades.example",
          "END:VCARD",
        ].join("\n"),
      );
    });

    it("omits ORG/URL lines entirely when company/website are absent", () => {
      const payload = buildStaticPayload({
        kind: "vcard",
        fullName: "Ana Pérez",
        phone: "+52 55 1234 5678",
        email: "ana@example.com",
      });
      expect(payload).not.toContain("ORG:");
      expect(payload).not.toContain("URL:");
    });

    it("escapes comma, semicolon, and backslash", () => {
      const payload = buildStaticPayload({
        kind: "vcard",
        fullName: "Smith; Jane, \\Esq",
        phone: "1",
        email: "a@b.com",
      });
      expect(payload).toContain("FN:Smith\\; Jane\\, \\\\Esq");
    });
  });

  describe("email", () => {
    it("builds a bare mailto: with no query when subject/body are absent", () => {
      expect(buildStaticPayload({ kind: "email", address: "a@b.com" })).toBe("mailto:a@b.com");
    });

    it("URL-encodes subject and body", () => {
      const payload = buildStaticPayload({
        kind: "email",
        address: "a@b.com",
        subject: "Hola & bienvenido",
        body: "Línea 1",
      });
      expect(payload).toBe("mailto:a@b.com?subject=Hola+%26+bienvenido&body=L%C3%ADnea+1");
    });
  });

  describe("sms", () => {
    it("builds a bare sms: with no query when message is absent", () => {
      expect(buildStaticPayload({ kind: "sms", number: "+525512345678" })).toBe("sms:+525512345678");
    });

    it("URL-encodes the message", () => {
      expect(buildStaticPayload({ kind: "sms", number: "123", message: "Hola!" })).toBe(
        "sms:123?body=Hola%21",
      );
    });
  });

  describe("wifi", () => {
    it("formats each security type", () => {
      expect(
        buildStaticPayload({ kind: "wifi", ssid: "Red", password: "pass", security: "WPA", hidden: false }),
      ).toBe("WIFI:T:WPA;S:Red;P:pass;H:false;;");
      expect(
        buildStaticPayload({ kind: "wifi", ssid: "Red", password: "pass", security: "WEP", hidden: false }),
      ).toContain("T:WEP;");
      expect(
        buildStaticPayload({ kind: "wifi", ssid: "Red", password: "", security: "nopass", hidden: false }),
      ).toContain("T:nopass;");
    });

    it("reflects hidden true/false", () => {
      expect(
        buildStaticPayload({ kind: "wifi", ssid: "Red", password: "pass", security: "WPA", hidden: true }),
      ).toContain("H:true;;");
    });

    it("escapes semicolon, comma, double quote, and backslash in SSID/password", () => {
      const payload = buildStaticPayload({
        kind: "wifi",
        ssid: 'Red;A,B"C\\D',
        password: "p;a,s\"s\\w",
        security: "WPA",
        hidden: false,
      });
      expect(payload).toBe('WIFI:T:WPA;S:Red\\;A\\,B\\"C\\\\D;P:p\\;a\\,s\\"s\\\\w;H:false;;');
    });
  });
});
