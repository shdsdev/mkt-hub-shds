import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({ getEvent: vi.fn(), select: vi.fn(), limit: vi.fn() }));
vi.mock("./service", () => ({ getEvent: mocks.getEvent }));
vi.mock("@/db/client", () => ({ db: { select: mocks.select } }));
vi.mock("@/modules/users", () => ({ isAdmin: ({ role }: { role: string }) => role === "ADMIN" }));

import { canAccessEvent } from "./access";
import { eventReceptionists } from "./db";

const input = {
  userId: "reception-1", organizationId: "org-1", role: "RECEPTION" as const,
  eventId: "event-1", capability: "dashboard" as const,
};
const from = vi.fn();
const where = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getEvent.mockResolvedValue({ id: input.eventId });
  mocks.select.mockReturnValue({ from });
  from.mockReturnValue({ where });
  where.mockReturnValue({ limit: mocks.limit });
  mocks.limit.mockResolvedValue([{ userId: input.userId }]);
});

describe("reception results authorization", () => {
  it("allows results only after checking organization and reception assignment", async () => {
    expect(await canAccessEvent(input)).toBe(true);
    expect(mocks.getEvent).toHaveBeenCalledWith(input.eventId, input.organizationId);
    expect(from).toHaveBeenCalledWith(eventReceptionists);
    const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.params).toEqual([input.eventId, input.userId]);
  });

  it("rejects results for an unassigned event", async () => {
    mocks.limit.mockResolvedValue([]);
    expect(await canAccessEvent(input)).toBe(false);
  });

  it("rejects events outside the organization without checking assignments", async () => {
    mocks.getEvent.mockResolvedValue(undefined);
    expect(await canAccessEvent(input)).toBe(false);
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
