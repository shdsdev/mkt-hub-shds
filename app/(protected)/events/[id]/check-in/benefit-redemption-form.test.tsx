// @vitest-environment jsdom

import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BenefitLookupResult } from "@/modules/events";
import * as benefitRedemptionForm from "./benefit-redemption-form";
import { benefitRedemptionState, transitionBenefitRedemptionState, BenefitRedemptionForm } from "./benefit-redemption-form";
import { listBenefitRedemptionsAction, redeemBenefitAction } from "./actions";
import { annulBenefitRedemptionAction } from "../benefits/actions";
import { canOwnScanner } from "./qr-scanner";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type EligibleBenefitLookup = Extract<BenefitLookupResult, { ok: true }>;

vi.mock("./actions", () => ({
  lookupBenefitRedemptionAction: vi.fn(),
  listBenefitRedemptionsAction: vi.fn(),
  redeemBenefitAction: vi.fn(),
}));

vi.mock("../benefits/actions", () => ({
  annulBenefitRedemptionAction: vi.fn(),
}));

vi.mock("./qr-scanner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./qr-scanner")>();
  return {
    ...actual,
    QrScanner: () => <div data-testid="qr-scanner" />,
    useScannerCoordinator: () => ({ claim: vi.fn(), release: vi.fn(), activeOwner: null }),
  };
});

vi.mock("./manual-folio-dialog", () => ({ ManualFolioDialog: () => null }));

let root: Root | undefined;
let container: HTMLDivElement | undefined;

const eligibleLookup = {
  ok: true,
  event: { id: "event-1", benefitRedemptionScope: "attendee" },
  attendee: { id: "attendee-1", fullName: "Ada Lovelace", checkedInAt: new Date("2026-10-23T10:00:00Z") },
  registration: { id: "registration-1" },
  redemption: null,
  benefits: [
    { id: "benefit-1", kind: "gift", name: "Kit de bienvenida", percentage: null, quantity: 10, remaining: 4, active: true },
    { id: "benefit-2", kind: "discount", name: null, percentage: 20, quantity: null, remaining: null, active: true },
  ],
} as unknown as EligibleBenefitLookup;

const history = [
  {
    id: "redemption-1",
    attendeeName: "Ana Pérez",
    benefitName: null,
    benefitKind: "discount" as const,
    benefitPercentage: 20,
    createdAt: new Date("2026-10-23T11:00:00Z"),
    actorName: "carlos@example.com",
    status: "active" as const,
  },
] as unknown as import("@/modules/events").BenefitRedemptionHistoryRow[];

function renderForm(overrides: Partial<ComponentProps<typeof BenefitRedemptionForm>> = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<BenefitRedemptionForm eventId="event-1" history={history} canAnnulHistory={false} {...overrides} />);
  });
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
});

describe("BenefitRedemptionForm", () => {
  it("allows only one scanner owner at a time", () => {
    expect(canOwnScanner(null, "check-in")).toBe(true);
    expect(canOwnScanner("check-in", "benefit")).toBe(false);
    expect(canOwnScanner("benefit", "benefit")).toBe(true);
  });

  it("renders the redemption card with manual and QR entry actions", () => {
    const html = renderToStaticMarkup(<BenefitRedemptionForm eventId="event-1" history={history} canAnnulHistory={false} />);

    expect(html).toContain("Validar beneficio");
    expect(html).toContain("Escanear QR");
    expect(html).toContain("Ingresar código");
    expect(html).toContain("Ver historial");
    expect(html).toContain("min-h-[min(72dvh,44rem)]");
  });

  it("opens an accessible history dialog without enabling annulment for reception", async () => {
    vi.mocked(listBenefitRedemptionsAction).mockResolvedValue({ ok: true, history });
    const rendered = renderForm();

    await act(async () => (rendered.querySelector('button[aria-label="Ver historial de canjes"]') as HTMLButtonElement)?.click());

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Ana Pérez");
    expect(document.body.textContent).toContain("20% de descuento");
    expect(document.body.textContent).toContain("carlos@example.com");
    expect(document.body.textContent).toContain("Activo");
    expect(document.body.textContent).not.toContain("Anular");
    expect(listBenefitRedemptionsAction).toHaveBeenCalledWith(expect.any(FormData));

    const historyPopup = document.querySelector('[role="dialog"]');
    expect(historyPopup?.className).toContain("top-1/2");
    expect(historyPopup?.className).toContain("left-1/2");
    expect(historyPopup?.className).toContain("-translate-x-1/2");
    expect(historyPopup?.className).toContain("-translate-y-1/2");
    expect(historyPopup?.className).toContain("w-[calc(100vw-2rem)]");
    expect(historyPopup?.className).toContain("max-w-3xl");
    expect(historyPopup?.className).not.toContain("lg:right-0");
    expect(historyPopup?.className).not.toContain("lg:left-auto");
    expect(historyPopup?.className).not.toContain("lg:inset-y-0");
  });

  it("keeps annulment available for admin and event editors", async () => {
    const rendered = renderForm({ canAnnulHistory: true });

    await act(async () => (rendered.querySelector('button[aria-label="Ver historial de canjes"]') as HTMLButtonElement)?.click());

    expect(document.body.textContent).toContain("Anular");
    expect(document.querySelector('textarea[name="reason"]')).toBeNull();
  });

  it("requires a confirmed check-in before enabling benefit selection", () => {
    const state = transitionBenefitRedemptionState(
      { ...benefitRedemptionState, lookup: { ...eligibleLookup, attendee: { ...eligibleLookup.attendee, checkedInAt: null } } },
      { type: "lookup-succeeded", result: { ...eligibleLookup, attendee: { ...eligibleLookup.attendee, checkedInAt: null } } },
    );

    expect(state.lookup?.attendee.checkedInAt).toBeNull();
    expect(state.error).toBe("Primero debe realizar el check-in.");
  });

  it("requires explicit selection before confirmation and shows remaining stock", () => {
    const state = transitionBenefitRedemptionState(
      { ...benefitRedemptionState, lookup: eligibleLookup },
      { type: "select-benefit", benefitId: "benefit-1" },
    );
    const html = renderToStaticMarkup(<BenefitRedemptionForm eventId="event-1" initialLookup={eligibleLookup} history={history} canAnnulHistory={false} />);

    expect(state.selectedBenefitId).toBe("benefit-1");
    expect(html).toContain("Disponibles: 4");
    expect(html).toContain("Confirmar canje");
  });

  it("does not offer benefits when the redemption scope is not configured", () => {
    const unconfiguredLookup = {
      ...eligibleLookup,
      event: { ...eligibleLookup.event, benefitRedemptionScope: null },
    } as unknown as EligibleBenefitLookup;
    const rendered = renderForm({ initialLookup: unconfiguredLookup });

    expect(rendered.textContent).toContain("Configura el alcance del canje en el editor de beneficios antes de continuar.");
    expect(rendered.querySelectorAll('input[type="radio"][name="benefit"]')).toHaveLength(0);
    expect(rendered.textContent).not.toContain("Kit de bienvenida");
    expect(rendered.textContent).not.toContain("20% de descuento");
    const confirmButton = Array.from(rendered.querySelectorAll("button")).find((button) => button.textContent?.includes("Confirmar canje"));
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.hasAttribute("disabled")).toBe(true);
  });

  it("shows successful and already-redeemed states with the assigned benefit", () => {
    const redeemed = { ...eligibleLookup, redemption: { id: "redemption-1", createdAt: new Date("2026-10-23T11:00:00Z") }, benefits: [] } as unknown as EligibleBenefitLookup;
    const success = transitionBenefitRedemptionState(benefitRedemptionState, { type: "redeem-succeeded", result: redeemed });
    const repeated = transitionBenefitRedemptionState(benefitRedemptionState, { type: "lookup-succeeded", result: redeemed });

    expect(success.success).toBe(true);
    expect(success.statusText).toBeUndefined();
    expect(success.lookup?.redemption?.id).toBe("redemption-1");
    expect(repeated.statusText).toBe("Beneficio ya canjeado");
  });

  it("replaces stale history after a successful redemption", async () => {
    const freshHistory = [{ ...history[0], id: "redemption-2", attendeeName: "Grace Hopper" }];
    vi.mocked(redeemBenefitAction).mockResolvedValue({ success: true, redemption: { benefitId: "benefit-1", createdAt: new Date(), actorName: "staff@example.com" } });
    vi.mocked(listBenefitRedemptionsAction)
      .mockResolvedValueOnce({ ok: true, history })
      .mockResolvedValueOnce({ ok: true, history: freshHistory });
    const rendered = renderForm({ initialLookup: eligibleLookup });

    await act(async () => {
      (rendered.querySelector('input[name="benefit"]') as HTMLInputElement).click();
      (Array.from(rendered.querySelectorAll("button")).find((button) => button.textContent?.includes("Confirmar canje")) as HTMLButtonElement).click();
    });
    await act(async () => (rendered.querySelector('button[aria-label="Ver historial de canjes"]') as HTMLButtonElement)?.click());

    expect(document.body.textContent).toContain("Grace Hopper");
    expect(document.body.textContent).not.toContain("Ana Pérez");
    expect(listBenefitRedemptionsAction).toHaveBeenCalledTimes(2);
  });

  it("refreshes history after a successful annulment", async () => {
    const freshHistory = [{ ...history[0], status: "annulled" as const }];
    vi.mocked(listBenefitRedemptionsAction).mockResolvedValueOnce({ ok: true, history }).mockResolvedValueOnce({ ok: true, history: freshHistory });
    vi.mocked(annulBenefitRedemptionAction).mockResolvedValue({ success: "Canje anulado correctamente." });
    const rendered = renderForm({ canAnnulHistory: true });

    await act(async () => (rendered.querySelector('button[aria-label="Ver historial de canjes"]') as HTMLButtonElement)?.click());
    await act(async () => (Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Anular")) as HTMLButtonElement).click());
    await act(async () => {
      const textarea = document.querySelector('textarea[name="reason"]') as HTMLTextAreaElement;
      textarea.value = "Correction";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      (Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Confirmar anulación")) as HTMLButtonElement).click();
    });

    expect(document.body.textContent).toContain("Anulado");
    expect(listBenefitRedemptionsAction).toHaveBeenCalledTimes(2);
  });

  it("labels a redeemed discount by its percentage when its name is null", () => {
    const label = (benefitRedemptionForm as typeof benefitRedemptionForm & {
      redeemedBenefitLabel?: (benefit: { kind: "gift" | "discount"; name: string | null; percentage: number | null } | undefined) => string;
    }).redeemedBenefitLabel?.({ kind: "discount", name: null, percentage: 20 });

    expect(label).toBe("20% de descuento");
  });
});
