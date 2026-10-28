// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transfer: vi.fn(), retry: vi.fn(), refresh: vi.fn(), close: vi.fn() }));
vi.mock("./actions", () => ({ transferPrimaryOwnershipAction: mocks.transfer, retryPrimaryTransferInvitationAction: mocks.retry }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { TransferPrimaryDialog } from "./transfer-primary-dialog";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.resetAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.transfer.mockResolvedValue({ success: "Titularidad transferida." });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(approved = true) {
  act(() => root.render(
    <TransferPrimaryDialog eventId="event-1" registrationId="reg-1" attendee={{ id: "attendee-1", fullName: "Pedro", email: "pedro@example.com" }} approved={approved} companions={2} onClose={mocks.close}>
      <input name="fullName" defaultValue="Ana" required />
      <input name="email" defaultValue="ana@example.com" type="email" required />
      <input name="phone" defaultValue="1234567890" />
      <input name="occupation" defaultValue="manufacturer" />
    </TransferPrimaryDialog>,
  ));
}
function button(text: string) {
  const found = [...document.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent === text);
  expect(found, `button: ${text}`).toBeTruthy();
  return found!;
}

describe("TransferPrimaryDialog", () => {
  it("reviews identity, preserves edits, and explains companions remain unchanged", async () => {
    render();
    await act(async () => document.querySelector("form")!.requestSubmit());
    expect(mocks.transfer).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Pedro");
    expect(document.body.textContent).toContain("Ana");
    expect(document.body.textContent).toMatch(/2 acompañantes permanecerán sin cambios/);
    await act(async () => button("Volver a editar").click());
    expect((document.querySelector('[name="fullName"]') as HTMLInputElement).value).toBe("Ana");
    expect(mocks.transfer).not.toHaveBeenCalled();
  });

  it("confirms once and keeps a pending registration email-free in the review", async () => {
    render(false);
    await act(async () => document.querySelector("form")!.requestSubmit());
    expect(document.body.textContent).toMatch(/No se enviará.*invitación/);
    await act(async () => { button("Sí, transferir titularidad").click(); button("Sí, transferir titularidad").click(); });
    expect(mocks.transfer).toHaveBeenCalledTimes(1);
  });
});
