import { describe, expect, it, vi } from "vitest";

const { checkDatabaseHealth } = vi.hoisted(() => ({ checkDatabaseHealth: vi.fn() }));
vi.mock("@/modules/monitoring", () => ({ checkDatabaseHealth }));

import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns healthy when the database probe succeeds", async () => {
    checkDatabaseHealth.mockResolvedValue(undefined);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: "marketing-hub" });
  });

  it("returns service unavailable when the database probe fails", async () => {
    checkDatabaseHealth.mockRejectedValue(new Error("database unavailable"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, service: "marketing-hub" });
  });
});
