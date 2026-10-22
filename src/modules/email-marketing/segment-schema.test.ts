import { describe, expect, it } from "vitest";
import { parseEmailSegmentDefinition } from "./segment-schema";

describe("email segment definitions", () => {
  it("accepts the allow-listed event and consent filters", () => {
    const definition = parseEmailSegmentDefinition({
      version: 1,
      filters: {
        subscriptionStatuses: ["subscribed"],
        eventIds: ["11111111-1111-4111-8111-111111111111"],
        registrationStatuses: ["confirmed"],
        interests: ["automation"],
        clientBrands: ["shades"],
        attributes: { state: "SLP" },
      },
    });

    expect(definition.filters.subscriptionStatuses).toEqual(["subscribed"]);
  });

  it("rejects arbitrary filter keys", () => {
    expect(() =>
      parseEmailSegmentDefinition({
        version: 1,
        filters: { rawSql: "select * from email_contacts" },
      }),
    ).toThrow();
  });

  it("rejects invalid event identifiers", () => {
    expect(() =>
      parseEmailSegmentDefinition({
        version: 1,
        filters: { eventIds: ["event-1"] },
      }),
    ).toThrow();
  });
});
