import { describe, expect, it } from "vitest";
import { canRoleAccessCapability } from "./access-policy";

describe("event access capabilities", () => {
  it("allows Reception to read registrations and check-in only", () => {
    expect(canRoleAccessCapability("RECEPTION", "registrations")).toBe(true);
    expect(canRoleAccessCapability("RECEPTION", "check-in")).toBe(true);
    expect(canRoleAccessCapability("RECEPTION", "questions")).toBe(true);
    expect(canRoleAccessCapability("RECEPTION", "internal-form")).toBe(false);
    expect(canRoleAccessCapability("RECEPTION", "edit")).toBe(false);
    expect(canRoleAccessCapability("RECEPTION", "raffle")).toBe(false);
  });

  it("allows Admin all event capabilities", () => {
    expect(canRoleAccessCapability("ADMIN", "registrations")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "check-in")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "internal-form")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "edit")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "raffle")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "questions")).toBe(true);
  });
});
