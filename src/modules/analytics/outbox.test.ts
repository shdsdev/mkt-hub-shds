import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({ env: {} }));

import { Ga4DeliveryError } from "./google";
import { nextOutboxDeliveryState } from "./outbox";

describe("nextOutboxDeliveryState", () => {
  it("does not retry permanent Measurement Protocol errors", () => {
    expect(nextOutboxDeliveryState(new Ga4DeliveryError("failed", "invalid payload"), 1)).toEqual({ status: "failed" });
  });

  it("backs off uncertain transport errors", () => {
    const next = nextOutboxDeliveryState(new Ga4DeliveryError("uncertain", "timeout"), 2);

    expect(next.status).toBe("uncertain");
    expect(next.availableAt).toBeInstanceOf(Date);
  });

  it("stops retrying after the bounded attempt limit", () => {
    expect(nextOutboxDeliveryState(new Ga4DeliveryError("uncertain", "timeout"), 5)).toEqual({ status: "failed" });
  });
});
