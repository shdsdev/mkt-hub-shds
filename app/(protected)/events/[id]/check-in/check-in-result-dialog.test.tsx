import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { describe, expect, it, vi } from "vitest";
import type { CheckInLookupResult, EventAttendeeRow, RegistrationWithAttendees } from "@/modules/events";
import {
  CheckInResultCard,
  NotFoundResultCard,
  categoryPresentation,
  getResultDialogClassName,
  resultDialogPopupClassName,
  statusPresentation,
} from "./check-in-result-dialog";

const attendee = {
  id: "attendee-1",
  fullName: "Ana Pérez",
  email: "ana@example.com",
  phone: "+54 11 5555-5555",
  company: "Acme Studio",
    occupation: "architect-decorator",
  passToken: "pass-token-1",
  backupCode: "ABC12345",
  checkedInAt: null,
} as unknown as EventAttendeeRow;

const registration = {
  attendees: [attendee, {
    ...attendee,
    id: "companion-1",
    fullName: "Bruno López",
    checkedInAt: null,
  }],
} as unknown as RegistrationWithAttendees;

type KnownResult = Exclude<CheckInLookupResult, { kind: "not_found" }>;

function eligibleResult(kind: "eligible" | "already_checked_in" | "blocked" = "eligible"): KnownResult {
  return kind === "blocked"
    ? { kind, reason: "waitlisted", attendee, registration }
    : { kind, attendee, registration };
}

const dialogProps = {
  open: true,
  confirmationRequired: true,
  confirming: false,
  onOpenChange: vi.fn(),
  onConfirm: vi.fn(),
  onConfirmCompanion: vi.fn(),
};

function renderCard(card: ReactNode) {
  return renderToStaticMarkup(<DialogPrimitive.Root open onOpenChange={dialogProps.onOpenChange}>{card}</DialogPrimitive.Root>);
}

describe("CheckInResultDialog", () => {
  it("maps every supported occupation to a visible label and color", () => {
    expect(categoryPresentation.wholesaler).toEqual({ label: "Mayorista", className: "bg-orange-600 text-white", surfaceClassName: "border-orange-500/40 bg-orange-500/10" });
    expect(categoryPresentation.manufacturer).toEqual({ label: "Fabricante", className: "bg-blue-600 text-white", surfaceClassName: "border-blue-500/40 bg-blue-500/10" });
    expect(categoryPresentation["architect-decorator"]).toEqual({ label: "Arquitecto / Decorador", className: "bg-green-600 text-white", surfaceClassName: "border-green-500/40 bg-green-500/10" });
    expect(categoryPresentation["installer-technician"]).toEqual({ label: "Instalador o técnico", className: "bg-red-600 text-white", surfaceClassName: "border-red-500/40 bg-red-500/10" });
  });

  it("tints the modal shell by access status", () => {
    expect(getResultDialogClassName(eligibleResult())).toContain("border-2 border-emerald-400/80");
    expect(getResultDialogClassName(eligibleResult("already_checked_in"))).toContain("border-2 border-amber-400/80");
    expect(getResultDialogClassName(eligibleResult("blocked"))).toContain("border-2 border-red-400/80");
    expect(getResultDialogClassName({ kind: "not_found" })).toContain("border-2 border-red-400/80");
  });

  it("renders attendee facts and the eligible confirmation action", () => {
    const html = renderCard(<CheckInResultCard result={eligibleResult()} {...dialogProps} />);

    expect(html).toContain("Ana Pérez");
    expect(html).toContain("+54 11 5555-5555");
    expect(html).toContain("Acme Studio");
    expect(html).toContain("ana@example.com");
    expect(html).toContain("Arquitecto");
    expect(html).toContain("Acceso correcto");
    expect(html).toContain("Confirmar entrada");
    expect(html).toContain("Registrar entrada");
    expect(html).toContain("Cerrar");
    expect(html).toContain("Pase digital");
    expect(html).toContain("bg-green-600 text-white");
  });

  it("renders confirmation errors and retry guidance inside the result dialog", () => {
    const html = renderCard(<CheckInResultCard result={eligibleResult()} error="No se pudo registrar la entrada." {...dialogProps} />);

    expect(html).toContain('role="alert"');
    expect(html).toContain("No se pudo registrar la entrada.");
    expect(html).toContain("Podés reintentar la confirmación.");
  });

  it("keeps blocked and already checked-in semantics visible", () => {
    const alreadyCheckedIn = renderCard(<CheckInResultCard result={eligibleResult("already_checked_in")} {...dialogProps} />);
    const blocked = renderCard(<CheckInResultCard result={eligibleResult("blocked")} {...dialogProps} />);
    const cancelled = renderCard(<CheckInResultCard result={{ kind: "blocked", reason: "cancelled", attendee, registration }} {...dialogProps} />);

    expect(alreadyCheckedIn).toContain("Ya registró entrada");
    expect(blocked).toContain("Lista de espera");
    expect(cancelled).toContain("Registro cancelado");
  });

  it("falls back safely when an attendee occupation is unknown", () => {
    const result = eligibleResult();
    const html = renderCard(<CheckInResultCard result={{ ...result, attendee: { ...attendee, occupation: "unlisted-occupation" } as EventAttendeeRow }} {...dialogProps} />);

    expect(html).toContain("Categoría no especificada");
  });

  it("renders not-found without attendee facts and keeps the close action", () => {
    const html = renderCard(<NotFoundResultCard onOpenChange={dialogProps.onOpenChange} />);

    expect(html).toContain("No encontrado");
    expect(html).toContain("No encontramos un asistente con ese folio en este evento.");
    expect(html).not.toContain("Ana Pérez");
    expect(html).toContain("Cerrar");
  });

  it("uses a full-screen small-screen shell with a bounded desktop modal", () => {
    expect(resultDialogPopupClassName).toContain("min-h-[100dvh]");
    expect(resultDialogPopupClassName).toContain("lg:max-w-2xl");
    expect(resultDialogPopupClassName).toContain("lg:max-h-[calc(100dvh-2rem)]");
    expect(resultDialogPopupClassName).toContain("lg:overflow-y-auto");
    expect(resultDialogPopupClassName).toContain("overflow-y-auto");
    expect(resultDialogPopupClassName).toContain("overflow-x-hidden");
    expect(resultDialogPopupClassName).toContain("env(safe-area-inset-top)");
    expect(resultDialogPopupClassName).toContain("env(safe-area-inset-right)");
    expect(resultDialogPopupClassName).toContain("env(safe-area-inset-bottom)");
    expect(resultDialogPopupClassName).toContain("env(safe-area-inset-left)");
  });

  it("breaks long attendee and fact values inside the result card", () => {
    const longToken = "attendee-".concat("x".repeat(120));
    const result = eligibleResult();
    const html = renderCard(<CheckInResultCard result={{
      ...result,
      attendee: {
        ...attendee,
        fullName: longToken,
        phone: longToken,
        company: longToken,
        email: `${longToken}@example.com`,
      } as EventAttendeeRow,
    }} {...dialogProps} />);

    expect(html).toContain(longToken);
    expect(html).toContain("break-all");
    expect(html).toContain("[overflow-wrap:anywhere]");
  });

  it("keeps status semantics independent from category color", () => {
    expect(statusPresentation.eligible).toMatchObject({ label: "Acceso correcto", iconLabel: "Acceso correcto", className: expect.stringContaining("emerald") });
    expect(statusPresentation.already_checked_in).toMatchObject({ label: "Ya registró entrada", className: expect.stringContaining("amber") });
    expect(statusPresentation.cancelled).toMatchObject({ label: "Registro cancelado", className: expect.stringContaining("red") });
    expect(statusPresentation.waitlisted).toMatchObject({ label: "Lista de espera", className: expect.stringContaining("red") });
    expect(statusPresentation.not_found).toMatchObject({ label: "No encontrado", className: expect.stringContaining("red") });
    expect(categoryPresentation.unknown).toEqual({ label: "Categoría no especificada", className: "bg-muted text-muted-foreground", surfaceClassName: "border-border bg-muted/30" });
  });
});
