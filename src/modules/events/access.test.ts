import { describe, expect, it } from "vitest";
import { canRoleAccessCapability } from "./access-policy";

describe("event access capabilities", () => {
  it("allows Reception operational capabilities and results without event management", () => {
    expect(canRoleAccessCapability("RECEPTION", "registrations")).toBe(true);
    expect(canRoleAccessCapability("RECEPTION", "check-in")).toBe(true);
    expect(canRoleAccessCapability("RECEPTION", "internal-form")).toBe(true);
    expect(canRoleAccessCapability("RECEPTION", "questions")).toBe(false);
    expect(canRoleAccessCapability("RECEPTION", "edit")).toBe(false);
    expect(canRoleAccessCapability("RECEPTION", "raffle")).toBe(false);
    expect(canRoleAccessCapability("RECEPTION", "dashboard")).toBe(true);
    expect(canRoleAccessCapability("RECEPTION", "benefit-redemption")).toBe(true);
    expect(canRoleAccessCapability("RECEPTION", "benefit-management")).toBe(false);
    expect(canRoleAccessCapability("RECEPTION", "audit")).toBe(false);
  });

  it("allows Admin all event capabilities", () => {
    expect(canRoleAccessCapability("ADMIN", "registrations")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "check-in")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "internal-form")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "edit")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "raffle")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "questions")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "benefit-redemption")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "benefit-management")).toBe(true);
    expect(canRoleAccessCapability("ADMIN", "audit")).toBe(true);
  });

  it("allows Event Editor all event capabilities", () => {
    expect(canRoleAccessCapability("EVENT_EDITOR", "registrations")).toBe(true);
    expect(canRoleAccessCapability("EVENT_EDITOR", "check-in")).toBe(true);
    expect(canRoleAccessCapability("EVENT_EDITOR", "internal-form")).toBe(true);
    expect(canRoleAccessCapability("EVENT_EDITOR", "edit")).toBe(true);
    expect(canRoleAccessCapability("EVENT_EDITOR", "raffle")).toBe(true);
    expect(canRoleAccessCapability("EVENT_EDITOR", "questions")).toBe(true);
    expect(canRoleAccessCapability("EVENT_EDITOR", "dashboard")).toBe(true);
    expect(canRoleAccessCapability("EVENT_EDITOR", "benefit-redemption")).toBe(true);
    expect(canRoleAccessCapability("EVENT_EDITOR", "benefit-management")).toBe(true);
    expect(canRoleAccessCapability("EVENT_EDITOR", "audit")).toBe(true);
  });

  it("does not grant benefit capabilities to unrelated roles", () => {
    expect(canRoleAccessCapability("MARKETING_USER", "benefit-redemption")).toBe(false);
    expect(canRoleAccessCapability("MARKETING_USER", "benefit-management")).toBe(false);
  });
});
