import { describe, expect, it } from "vitest";
import { formatEmailImportSummary, parseEmailContactCsv } from "@/lib/email-contact-import";

describe("email contact CSV import", () => {
  it("parses supported columns and preserves additional columns as attributes", () => {
    const result = parseEmailContactCsv(
      'email,full_name,phone,company,tag,region\ncustomer@example.com,"Customer, Example",555-0100,Acme,VIP,North',
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        email: "customer@example.com",
        fullName: "Customer, Example",
        phone: "555-0100",
        company: "Acme",
        tags: ["VIP"],
        attributes: { region: "North" },
      },
    ]);
  });

  it("accepts Mailchimp headers, combines names, splits tags, and preserves custom fields", () => {
    const result = parseEmailContactCsv(
      'Email Address,First Name,Last Name,Address,Phone,What do you like to grow?,Tags,Birthday\n' +
      'maya@example.com,Maya,White,"154 Example Dr",555-0100,"Indoor plants","influencer, uses coupons, local",08/03',
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      email: "maya@example.com",
      fullName: "Maya White",
      phone: "555-0100",
      tags: ["influencer", "uses coupons", "local"],
      attributes: { address: "154 Example Dr", "what do you like to grow?": "Indoor plants", birthday: "08/03" },
    });
  });

  it("reports invalid and duplicate emails without discarding valid rows", () => {
    const result = parseEmailContactCsv(
      "email,full_name\nnot-an-email,Bad\ncustomer@example.com,First\nCUSTOMER@example.com,Duplicate",
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.email).toBe("customer@example.com");
    expect(result.errors).toEqual([
      { rowNumber: 2, message: "Email inválido." },
      { rowNumber: 4, message: "Email duplicado dentro del archivo." },
    ]);
  });

  it("rejects emails longer than the persistence limit during preview", () => {
    const longEmail = `${"a".repeat(310)}@example.com`;
    const result = parseEmailContactCsv(`email,full_name\n${longEmail},Too long`);

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([{ rowNumber: 2, message: "Email inválido." }]);
  });

  it("imports an explicit subscribed status only when consent evidence is present", () => {
    const result = parseEmailContactCsv(
      "email,subscription_status,consent_source,consented_at\ncustomer@example.com,subscribed,purchase_tc,2026-01-15T12:00:00Z",
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      email: "customer@example.com",
      subscriptionStatus: "subscribed",
      consentSource: "purchase_tc",
      consentedAt: "2026-01-15T12:00:00.000Z",
    });
  });

  it("keeps subscribed contacts pending when consent evidence is incomplete", () => {
    const result = parseEmailContactCsv(
      "email,subscription_status,consent_source\ncustomer@example.com,subscribed,",
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      email: "customer@example.com",
      subscriptionStatus: "pending",
      warnings: ["El estado subscribed requiere consent_source y consented_at; se importará como pending."],
    });
  });

  it("rejects unsupported subscription statuses", () => {
    const result = parseEmailContactCsv(
      "email,subscription_status\ncustomer@example.com,active",
    );

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([{ rowNumber: 2, message: "Estado de suscripción inválido." }]);
  });

  it("explains partial imports with created, updated, and failed counts", () => {
    expect(formatEmailImportSummary({ created: 347, updated: 1612, failed: 1 })).toBe(
      "Importación parcial: 1959 importados (347 nuevos, 1612 actualizados) y 1 no importado.",
    );
  });
});
