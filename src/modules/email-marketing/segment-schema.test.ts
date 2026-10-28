import { describe, expect, it } from "vitest";
import { parseEmailSegmentDefinition } from "./segment-schema";

describe("email segment definitions", () => {
  it("accepts filters executed by the audience engine", () => {
    const definition = parseEmailSegmentDefinition({
      version: 1,
      filters: {
        subscriptionStatuses: ["subscribed"],
        eventIds: ["11111111-1111-4111-8111-111111111111"],
        tags: ["Drapery"],
      },
    });

    expect(definition.filters.subscriptionStatuses).toEqual(["subscribed"]);
    expect(definition.filters.tags).toEqual(["Drapery"]);
  });

  it("rejects arbitrary filter keys", () => {
    expect(() =>
      parseEmailSegmentDefinition({
        version: 1,
        filters: { rawSql: "select * from email_contacts" },
      }),
    ).toThrow();
  });

  it("rejects filters that the audience engine cannot execute", () => {
    expect(() =>
      parseEmailSegmentDefinition({
        version: 1,
        filters: { interests: ["automation"] },
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

  it("accepts reusable rule conditions with all/any logic", () => {
    const definition = parseEmailSegmentDefinition({
      version: 1,
      filters: {
        logic: "any",
        conditions: [
          { field: "fullName", operator: "contains", value: "Drapery" },
          { field: "tag", operator: "has", value: "cliente" },
        ],
      },
    });

    expect(definition.filters.logic).toBe("any");
    expect(definition.filters.conditions).toHaveLength(2);
  });
});
