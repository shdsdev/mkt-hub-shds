import { describe, expect, it, vi } from "vitest";

const { captureException, setTag, withScope } = vi.hoisted(() => {
  const captureException = vi.fn();
  const setTag = vi.fn();
  const withScope = vi.fn((callback: (scope: { setTag: typeof setTag }) => void) => callback({ setTag }));
  return { captureException, setTag, withScope };
});

vi.mock("@sentry/nextjs", () => ({ captureException, withScope }));

import { captureOperationFailure } from "./capture-operation-failure";

describe("captureOperationFailure", () => {
  it("captures technical failures with operation tags and no input payload", () => {
    captureOperationFailure({ operation: "qr_bulk_create", module: "qr", error: new Error("database unavailable") });
    expect(setTag).toHaveBeenCalledWith("operation", "qr_bulk_create");
    expect(setTag).toHaveBeenCalledWith("module", "qr");
    expect(captureException).toHaveBeenCalledWith(expect.any(Error));
    expect(JSON.stringify(captureException.mock.calls)).not.toContain("FormData");
  });
});
