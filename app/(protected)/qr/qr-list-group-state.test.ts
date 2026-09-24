import { describe, expect, it } from "vitest";
import { requiresGroupSelection } from "./qr-list-group-state";

describe("requiresGroupSelection", () => {
  it("does not show general QR rows until a folder is selected", () => {
    expect(requiresGroupSelection("folders", undefined, undefined)).toBe(true);
    expect(requiresGroupSelection("folders", "folder-1", undefined)).toBe(false);
  });

  it("does not show general QR rows until a campaign is selected", () => {
    expect(requiresGroupSelection("campaigns", undefined, undefined)).toBe(true);
    expect(requiresGroupSelection("campaigns", undefined, "campaign-1")).toBe(false);
  });

  it("keeps all QR rows visible from the all tab", () => {
    expect(requiresGroupSelection("all", undefined, undefined)).toBe(false);
  });
});
