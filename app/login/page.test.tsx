// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  login: vi.fn(),
}));

vi.mock("./recovery-actions", () => ({
  requestPasswordRecovery: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => new URLSearchParams("error=invitation")),
}));

import LoginPage from "./page";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("LoginPage", () => {
  it("reveals a password setup form from the recovery action", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<LoginPage />));

    const recoveryTrigger = [...(container?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.includes("Crear o restablecer contraseña"),
    );
    expect(recoveryTrigger).not.toBeUndefined();

    act(() => recoveryTrigger?.click());

    expect(container?.querySelector('[data-recovery-form] input[name="email"]')).not.toBeNull();
    expect(container?.textContent).toContain("Enviar enlace");
  });

  it("explains when an invitation link has expired", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<LoginPage />));

    expect(container?.textContent).toContain("La invitación expiró");
  });
});
