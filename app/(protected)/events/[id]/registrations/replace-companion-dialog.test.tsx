// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), retry: vi.fn(), refresh: vi.fn(), close: vi.fn() }));
vi.mock("./actions", () => ({ replaceCompanionAction: mocks.replace, retryReplacementInvitationAction: mocks.retry }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { ReplaceCompanionDialog } from "./replace-companion-dialog";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.resetAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.replace.mockResolvedValue({ success: "Acompañante reemplazado." });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(approved = true) {
  act(() => root.render(
    <ReplaceCompanionDialog eventId="event-1" registrationId="reg-1" attendee={{ id: "attendee-1", fullName: "Pedro", email: "pedro@example.com" }} approved={approved} onClose={mocks.close}>
      <input name="fullName" defaultValue="Ana" required />
      <input name="email" defaultValue="ana@example.com" type="email" required />
      <input name="phone" defaultValue="1234567890" />
      <input name="occupation" defaultValue="manufacturer" />
    </ReplaceCompanionDialog>,
  ));
}
function button(text: string) {
  const found = [...document.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent === text);
  expect(found, `button: ${text}`).toBeTruthy();
  return found!;
}
async function click(text: string) {
  await act(async () => button(text).click());
}
async function review() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

describe("ReplaceCompanionDialog", () => {
  it("reviews without mutation, shows old/new identity and invalidation warning, and preserves edits on back", async () => {
    render();
    expect(button("Revisar reemplazo")).toBeTruthy();
    await review();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Pedro");
    expect(document.body.textContent).toContain("pedro@example.com");
    expect(document.body.textContent).toContain("Ana");
    expect(document.body.textContent).toContain("ana@example.com");
    expect(document.body.textContent).toMatch(/QR y código anteriores dejarán de funcionar/);
    expect(document.body.textContent).toMatch(/enviará.*invitación/);
    await click("Volver a editar");
    expect((document.querySelector('[name="fullName"]') as HTMLInputElement).value).toBe("Ana");
    expect((document.querySelector('[name="email"]') as HTMLInputElement).value).toBe("ana@example.com");
    expect((document.querySelector('[name="phone"]') as HTMLInputElement).value).toBe("1234567890");
    expect((document.querySelector('[name="occupation"]') as HTMLInputElement).value).toBe("manufacturer");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("explains that pending registration remains pending and no email is sent", async () => {
    render(false);
    await review();
    expect(document.body.textContent).toMatch(/pendiente de aprobación/);
    expect(document.body.textContent).toMatch(/No se enviará.*invitación/);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("requires occupation before review", async () => {
    render();
    (document.querySelector('[name="occupation"]') as HTMLInputElement).value = "";
    await review();
    expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/actividad profesional/i);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("confirms once and blocks back, close and escape while pending", async () => {
    let finish!: (value: { success: string }) => void;
    mocks.replace.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render();
    await review();
    await act(async () => {
      const confirm = button("Sí, reemplazar acompañante");
      confirm.click();
      confirm.click();
    });
    expect(mocks.replace).toHaveBeenCalledTimes(1);
    const submitted = mocks.replace.mock.calls[0][1] as FormData;
    expect(submitted.get("fullName")).toBe("Ana");
    expect(submitted.get("attendeeId")).toBe("attendee-1");
    expect(button("Volver a editar").disabled).toBe(true);
    const close = document.querySelector<HTMLButtonElement>('[aria-label="Cerrar"]')!;
    expect(close.disabled).toBe(true);
    await act(async () => {
      close.click();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(mocks.close).not.toHaveBeenCalled();
    await act(async () => finish({ success: "Acompañante reemplazado." }));
    expect(document.body.textContent).toContain("Acompañante reemplazado.");
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps completed replacement warning visible and retries only delivery with returned identifiers", async () => {
    mocks.replace.mockResolvedValue({ success: "Acompañante reemplazado.", warning: "El reemplazo se completó, pero no se pudo enviar la invitación.", retry: { eventId: "event-1", registrationId: "reg-1", attendeeId: "attendee-1" } });
    mocks.retry.mockResolvedValueOnce({ error: "No se pudo enviar la invitación." }).mockResolvedValueOnce({ success: "Invitación enviada por correo." });
    render();
    await review();
    await click("Sí, reemplazar acompañante");
    expect(document.body.textContent).toContain("El reemplazo se completó");
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    await click("Reintentar envío de invitación");
    expect(document.body.textContent).toContain("No se pudo enviar la invitación.");
    await click("Reintentar envío de invitación");
    expect(document.body.textContent).toContain("Invitación enviada por correo.");
    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.retry).toHaveBeenCalledTimes(2);
    const retryData = mocks.retry.mock.calls[0][1] as FormData;
    expect(Object.fromEntries(retryData)).toEqual({ eventId: "event-1", registrationId: "reg-1", attendeeId: "attendee-1" });
    expect(document.body.textContent).not.toContain("El reemplazo se completó, pero");
    await click("Cerrar");
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
