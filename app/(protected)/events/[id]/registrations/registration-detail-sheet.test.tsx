// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RegistrationWithAttendees } from "@/modules/events";

const mocks = vi.hoisted(() => ({ remove: vi.fn(), review: vi.fn(), refresh: vi.fn(), close: vi.fn() }));
vi.mock("./actions", () => ({ deleteRegistrationAction: mocks.remove, updateRegistrationReviewStatusAction: mocks.review }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("./add-companion-row", () => ({ AddCompanionRow: () => null }));
vi.mock("./attendee-actions", () => ({ AttendeeActions: () => null }));
vi.mock("./resend-invitation-button", () => ({ ResendInvitationButton: () => null }));
vi.mock("./access-code-copy-button", () => ({ AccessCodeCopyButton: () => null }));

import { RegistrationDetailSheet } from "./registration-detail-sheet";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.remove.mockResolvedValue({ success: "Registro eliminado. No se enviaron correos." });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(overrides: Partial<RegistrationWithAttendees> = {}, canDeleteRegistrations = true) {
  const registration = {
    id: "reg-1", eventId: "event-1", organizationId: "org-1", source: "public", status: "pending_review",
    reviewStatus: "new", firstApprovedAt: null, deletionProtected: false, createdAt: new Date("2026-11-01T12:00:00Z"),
    clientBrands: [], interests: [], consents: null, customFormAnswers: {},
    attendees: [{ id: "att-1", isPrimary: true, fullName: "Ana", email: "ana@example.com", checkedInAt: null }],
    ...overrides,
  } as RegistrationWithAttendees;
  act(() => root.render(<RegistrationDetailSheet registration={registration} statusLabel="Pendiente" open onOpenChange={mocks.close}
    eventId="event-1" eventName="Workshop" collectCompany={false} collectJobTitle={false} phoneRequired={false}
    canManageAttendees={true} canDeleteRegistrations={canDeleteRegistrations} />));
}
function button(text: string) {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent === text);
}

describe("silent registration deletion", () => {
  it("offers direct deletion to an admin without requiring rejection", async () => {
    render();
    expect(button("Eliminar registro")).toBeTruthy();
    await act(async () => button("Eliminar registro")!.click());
    expect(document.body.textContent).toContain("No se enviará ningún correo");
    expect(document.body.textContent).toContain("No se puede deshacer");
    expect(document.body.textContent).toContain("otros eventos");
    expect(mocks.review).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    await act(async () => button("Eliminar definitivamente")!.click());
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    const submitted = mocks.remove.mock.calls[0][1] as FormData;
    expect(submitted.get("registrationId")).toBe("reg-1");
    expect(submitted.get("eventId")).toBe("event-1");
    expect(mocks.review).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledWith(false);
  });

  it("hides deletion from non-admin managers", () => {
    render({}, false);
    expect(button("Eliminar registro")).toBeUndefined();
  });

  it.each([
    { source: "admin_added" },
    { reviewStatus: "approved" },
    { status: "confirmed" },
    { status: "checked_in" },
    { status: "rejected", firstApprovedAt: new Date("2026-11-01") },
    { deletionProtected: true },
    { firstApprovedAt: undefined },
  ] as Partial<RegistrationWithAttendees>[])("hides deletion for protected registration %j", (overrides) => {
    render(overrides);
    expect(button("Eliminar registro")).toBeUndefined();
  });

  it("does not delete if confirmation is cancelled", async () => {
    render();
    await act(async () => button("Eliminar registro")!.click());
    await act(async () => button("Cancelar")!.click());
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it("hides deletion when an inactive companion has checked in", () => {
    render({ attendees: [
      { id: "att-1", isPrimary: true, fullName: "Ana", checkedInAt: null },
      { id: "att-2", isPrimary: false, fullName: "Companion", checkedInAt: new Date(), isActive: false },
    ] as RegistrationWithAttendees["attendees"] });
    expect(button("Eliminar registro")).toBeUndefined();
  });

  it("disables repeated deletion, review, cancellation and close while deleting", async () => {
    let finish!: (value: { success: string }) => void;
    mocks.remove.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render();
    await act(async () => button("Eliminar registro")!.click());
    await act(async () => button("Eliminar definitivamente")!.click());
    expect(button("Eliminando…")?.disabled).toBe(true);
    expect(button("Cancelar")?.disabled).toBe(true);
    expect(button("Aprobar")?.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[aria-label="Cerrar detalle"]')?.disabled).toBe(true);
    expect(mocks.close).not.toHaveBeenCalled();
    await act(async () => finish({ success: "Registro eliminado. No se enviaron correos." }));
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });

  it("keeps a server-side eligibility error visible without closing", async () => {
    mocks.remove.mockResolvedValue({ error: "El registro fue aprobado por otro administrador." });
    render();
    await act(async () => button("Eliminar registro")!.click());
    await act(async () => button("Eliminar definitivamente")!.click());
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("aprobado por otro administrador");
    expect(mocks.close).not.toHaveBeenCalled();
  });
});
