import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  canAccessEvent: vi.fn(),
  listEventBenefits: vi.fn(),
  saveEventBenefitsConfiguration: vi.fn(),
  saveEventBenefit: vi.fn(),
  deactivateEventBenefit: vi.fn(),
  setEventBenefitRedemptionScope: vi.fn(),
  annulBenefitRedemption: vi.fn(),
  recordAudit: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive }));
vi.mock("@/modules/audit", () => ({ checkRateLimit: mocks.checkRateLimit, recordAudit: mocks.recordAudit }));
vi.mock("@/modules/events", () => ({
  canAccessEvent: mocks.canAccessEvent,
  listEventBenefits: mocks.listEventBenefits,
  saveEventBenefitsConfiguration: mocks.saveEventBenefitsConfiguration,
  saveEventBenefit: mocks.saveEventBenefit,
  deactivateEventBenefit: mocks.deactivateEventBenefit,
  setEventBenefitRedemptionScope: mocks.setEventBenefitRedemptionScope,
  annulBenefitRedemption: mocks.annulBenefitRedemption,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  annulBenefitRedemptionAction,
  createBenefitAction,
  deactivateBenefitAction,
  listBenefitsAction,
  updateBenefitScopeAction,
  saveBenefitsConfigurationAction,
} from "./actions";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const BENEFIT_ID = "22222222-2222-4222-8222-222222222222";
const REDEMPTION_ID = "33333333-3333-4333-8333-333333333333";
const user = { id: "admin-1", profile: { organizationId: "org-1", role: "ADMIN", status: "active" } };

function form(fields: Record<string, string>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(fields)) result.set(key, value);
  return result;
}

describe("event benefit management actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.isActive.mockReturnValue(true);
    mocks.canAccessEvent.mockResolvedValue(true);
    mocks.checkRateLimit.mockReturnValue(true);
  });

  it("lists benefits only through the management capability", async () => {
    mocks.listEventBenefits.mockResolvedValue([]);

    const result = await listBenefitsAction(form({ eventId: EVENT_ID }));

    expect(result).toEqual({ ok: true, benefits: [] });
    expect(mocks.canAccessEvent).toHaveBeenCalledWith(expect.objectContaining({ capability: "benefit-management" }));
  });

  it("creates a benefit and records an audit entry", async () => {
    mocks.saveEventBenefit.mockResolvedValue({ ok: true, benefit: { id: BENEFIT_ID } });

    const result = await createBenefitAction(form({ eventId: EVENT_ID, kind: "gift", name: "Café", quantity: "10" }));

    expect(result).toEqual({ success: "Beneficio guardado correctamente." });
    expect(mocks.saveEventBenefit).toHaveBeenCalledWith(expect.objectContaining({ eventId: EVENT_ID, kind: "gift", quantity: 10 }));
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "create", resourceType: "event_benefit", resourceId: BENEFIT_ID }));
  });

  it("requires a non-empty reason before annulment", async () => {
    const result = await annulBenefitRedemptionAction(form({ eventId: EVENT_ID, redemptionId: REDEMPTION_ID, reason: " " }));

    expect(result).toEqual({ error: "Indica el motivo de la anulación." });
    expect(mocks.annulBenefitRedemption).not.toHaveBeenCalled();
  });

  it("passes the authorized event scope to the annulment service", async () => {
    mocks.annulBenefitRedemption.mockResolvedValue({ ok: false, reason: "not_found" });

    await annulBenefitRedemptionAction(form({ eventId: EVENT_ID, redemptionId: REDEMPTION_ID, reason: "Correction" }));

    expect(mocks.annulBenefitRedemption).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      redemptionId: REDEMPTION_ID,
      actorId: user.id,
      reason: "Correction",
    });
  });

  it("locks scope changes through the domain result", async () => {
    mocks.setEventBenefitRedemptionScope.mockResolvedValue({ ok: false, reason: "scope_locked" });

    const result = await updateBenefitScopeAction(form({ eventId: EVENT_ID, scope: "registration" }));

    expect(result).toEqual({ error: "El alcance no puede cambiarse después del primer canje." });
  });

  it("persists scope and multiple catalog rows through one configuration submit", async () => {
    mocks.saveEventBenefitsConfiguration.mockResolvedValue({ ok: true });

    const result = await saveBenefitsConfigurationAction(form({
      eventId: EVENT_ID,
      configuration: JSON.stringify({
        scope: "registration",
        benefits: [
          { id: BENEFIT_ID, kind: "gift", name: "Kit", quantity: 10, active: true },
          { kind: "discount", percentage: 20, quantity: null, active: true },
        ],
      }),
    }));

    expect(result).toEqual({ success: "Cambios guardados correctamente." });
    expect(mocks.saveEventBenefitsConfiguration).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      scope: "registration",
      benefits: [
        { benefitId: BENEFIT_ID, kind: "gift", name: "Kit", quantity: 10, active: true },
        { benefitId: undefined, kind: "discount", percentage: 20, quantity: null, active: true },
      ],
    });
  });

  it("rejects invalid kind-specific fields and quantities before mutating", async () => {
    const result = await saveBenefitsConfigurationAction(form({
      eventId: EVENT_ID,
      configuration: JSON.stringify({
        scope: "attendee",
        benefits: [{ kind: "gift", name: "", quantity: -1, active: true }],
      }),
    }));

    expect(result).toEqual({ error: "Revisa la configuración de los beneficios." });
    expect(mocks.saveEventBenefitsConfiguration).not.toHaveBeenCalled();
  });

  it("does not mutate when management access is denied", async () => {
    mocks.canAccessEvent.mockResolvedValue(false);

    const result = await deactivateBenefitAction(form({ eventId: EVENT_ID, benefitId: BENEFIT_ID }));

    expect(result).toEqual({ error: "No tienes permiso para administrar los beneficios." });
    expect(mocks.deactivateEventBenefit).not.toHaveBeenCalled();
  });
});
