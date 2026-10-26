import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CheckInLookupResult } from "@/modules/events";
import { canSubmitManualFolio, manualFolioDialogPopupClassName } from "./manual-folio-dialog";
import { scannerCaptureClassName } from "./check-in-form";

vi.mock("./actions", () => ({
  lookupCheckInAction: vi.fn(),
  confirmCheckInAction: vi.fn(),
}));

vi.mock("./qr-scanner", () => ({
  QrScanner: () => <div data-testid="qr-scanner" />,
  useScannerCoordinator: () => ({ claim: vi.fn(), release: vi.fn(), activeOwner: null }),
}));

vi.mock("./manual-folio-dialog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./manual-folio-dialog")>();
  return {
    ...actual,
    ManualFolioDialog: () => null,
  };
});

vi.mock("./check-in-result-dialog", () => ({
  CheckInResultDialog: () => null,
}));

import { CheckInForm, checkInState, transitionCheckInState } from "./check-in-form";

describe("CheckInForm idle surface", () => {
  it("renders exactly the two check-in entry actions", () => {
    const html = renderToStaticMarkup(<CheckInForm eventId="event-1" confirmationRequired />);

    expect(html).toContain("Check-in operativo");
    expect(html).toContain("Validar acceso");
    expect(html.match(/Escanear QR/g)).toHaveLength(1);
    expect(html.match(/Ingresar código/g)).toHaveLength(1);
    expect(html).toContain("p-6 sm:p-7");
    expect(html).not.toContain("min-h-[min(72dvh,44rem)]");
  });
});

const eligibleResult = { kind: "eligible" } as CheckInLookupResult;

describe("CheckInForm state transitions", () => {
  it("opens the scanner and clears stale errors", () => {
    const state = transitionCheckInState(
      { ...checkInState, mode: "manual", error: "No se encontró el folio." },
      { type: "open-scanner" },
    );

    expect(state).toMatchObject({ mode: "scanner", error: undefined });
  });

  it("cancels scanner capture and returns to idle", () => {
    const state = transitionCheckInState({ ...checkInState, mode: "scanner" }, { type: "capture-closed" });

    expect(state).toMatchObject({ mode: "idle" });
  });

  it("keeps scanner errors on the open capture surface for retry", () => {
    const state = transitionCheckInState({ ...checkInState, mode: "scanner" }, { type: "capture-failed", error: "No se pudo acceder a la cámara." });

    expect(state).toMatchObject({ mode: "scanner", error: "No se pudo acceder a la cámara." });
  });

  it("keeps QR lookup errors on the active scanner surface for retry", () => {
    const stateAfterLookup = transitionCheckInState({ ...checkInState, mode: "scanner" }, { type: "lookup-started" });
    const state = transitionCheckInState(stateAfterLookup, { type: "lookup-failed", error: "No se encontró el folio." });

    expect(state).toMatchObject({ mode: "scanner", pending: false, error: "No se encontró el folio." });
  });

  it("keeps manual lookup errors on the active code-entry surface for retry", () => {
    const state = transitionCheckInState({ ...checkInState, mode: "manual", pending: true }, { type: "lookup-failed", error: "No se encontró el folio." });

    expect(state).toMatchObject({ mode: "manual", pending: false, error: "No se encontró el folio." });
  });

  it("cancels manual capture and returns to idle", () => {
    const state = transitionCheckInState({ ...checkInState, mode: "manual" }, { type: "capture-closed" });

    expect(state).toMatchObject({ mode: "idle" });
  });

  it("prevents duplicate manual submits while lookup is pending", () => {
    expect(canSubmitManualFolio("AB12CD34", true)).toBe(false);
    expect(canSubmitManualFolio("AB12CD34", false)).toBe(true);
  });

  it("keeps the manual capture surface full-screen through tablet widths", () => {
    expect(manualFolioDialogPopupClassName).toContain("min-h-[100dvh]");
    expect(manualFolioDialogPopupClassName).toContain("lg:max-w-md");
    expect(manualFolioDialogPopupClassName).not.toContain("sm:max-w-md");
    expect(manualFolioDialogPopupClassName).toContain("env(safe-area-inset-top)");
    expect(manualFolioDialogPopupClassName).toContain("env(safe-area-inset-right)");
    expect(manualFolioDialogPopupClassName).toContain("env(safe-area-inset-bottom)");
    expect(manualFolioDialogPopupClassName).toContain("env(safe-area-inset-left)");
    expect(scannerCaptureClassName).toContain("env(safe-area-inset-top)");
    expect(scannerCaptureClassName).toContain("env(safe-area-inset-right)");
    expect(scannerCaptureClassName).toContain("env(safe-area-inset-bottom)");
    expect(scannerCaptureClassName).toContain("env(safe-area-inset-left)");
  });

  it("opens manual mode and clears stale errors", () => {
    const state = transitionCheckInState(
      { ...checkInState, mode: "scanner", error: "No se pudo acceder a la cámara." },
      { type: "open-manual" },
    );

    expect(state).toMatchObject({ mode: "manual", error: undefined });
  });

  it("opens a successful lookup result and closes capture", () => {
    const state = transitionCheckInState(
      { ...checkInState, mode: "scanner", pending: true, error: "stale" },
      { type: "lookup-succeeded", result: eligibleResult },
    );

    expect(state).toMatchObject({
      mode: "idle",
      result: eligibleResult,
      resultOpen: true,
      pending: false,
      error: undefined,
    });
  });

  it("returns to idle when the result is closed", () => {
    const state = transitionCheckInState(
      { ...checkInState, mode: "manual", result: eligibleResult, resultOpen: true },
      { type: "close-result" },
    );

    expect(state).toMatchObject({ mode: "idle", result: eligibleResult, resultOpen: false });
  });

  it("keeps the result open after confirmation succeeds until explicitly closed", () => {
    const state = transitionCheckInState(
      { ...checkInState, result: eligibleResult, resultOpen: true, pending: true },
      { type: "confirmation-succeeded" },
    );

    expect(state).toMatchObject({ result: eligibleResult, resultOpen: true, pending: false });
  });

  it("keeps the result open when confirmation fails", () => {
    const state = transitionCheckInState(
      { ...checkInState, result: eligibleResult, resultOpen: true, pending: true },
      { type: "confirmation-failed", error: "No se pudo registrar la entrada." },
    );

    expect(state).toMatchObject({
      result: eligibleResult,
      resultOpen: true,
      pending: false,
      error: "No se pudo registrar la entrada.",
    });
  });
});
