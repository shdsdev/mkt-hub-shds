import { describe, expect, it } from "vitest";
import { canRoleAccessCapability } from "./access-policy";

describe("event access capabilities", () => {
  it("allows Reception to read registrations, check-in, and the internal form only", () => {
    expect(canRoleAccessCapability("RECEPTION", "registrations")).toBe(true);
    expect(canRoleAccessCapability("RECEPTION", "check-in")).toBe(true);
    expect(canRoleAccessCapability("RECEPTION", "internal-form")).toBe(true);
    expect(canRoleAccessCapability("RECEPTION", "questions")).toBe(false);
    expect(canRoleAccessCapability("RECEPTION", "edit")).toBe(false);
    expect(canRoleAccessCapability("RECEPTION", "raffle")).toBe(false);
    expect(canRoleAccessCapability("RECEPTION", "dashboard")).toBe(false);
  });

  it("allows Admin all event capabilities", () => {
    expect(canRoleAccessCapability("ADMIN", "registrations")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "check-in")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "internal-form")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "edit")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "raffle")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "questions")).toBe(true);
  });

  it("allows Event Editor all event capabilities", () => {
    expect(canRoleAccessCapability("EVENT_EDITOR", "registrations")).toBe(true);
    expect(canRoleAccessCapability("EVENT_EDITOR", "check-in")).toBe(true);
    expect(canRoleAccessCapability("EVENT_EDITOR", "internal-form")).toBe(true);
    expect(canRoleAccessCapability("EVENT_EDITOR", "edit")).toBe(true);
    expect(canRoleAccessCapability("EVENT_EDITOR", "raffle")).toBe(true);
    expect(canRoleAccessCapability("EVENT_EDITOR", "questions")).toBe(true);
    expect(canRoleAccessCapability("EVENT_EDITOR", "dashboard")).toBe(true);
  });
});
