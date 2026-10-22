// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const oauthMocks = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));
const searchParamsMock = vi.hoisted(() => vi.fn(() => new URLSearchParams("error=invitation")));

vi.mock("./actions", () => ({
  login: vi.fn(),
}));

vi.mock("./recovery-actions", () => ({
  requestPasswordRecovery: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({ auth: { signInWithOAuth: oauthMocks.signInWithOAuth } })),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: searchParamsMock,
}));

import LoginPage from "./page";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  searchParamsMock.mockReturnValue(new URLSearchParams("error=invitation"));
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("LoginPage", () => {
  it("starts Google OAuth with the invitation-only callback", async () => {
    oauthMocks.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<LoginPage />));

    const googleButton = [...(container?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.includes("Continuar con Google"),
    );
    expect(googleButton).not.toBeUndefined();
    expect(googleButton?.disabled).toBe(false);

    await act(async () => googleButton?.click());

    expect(oauthMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "http://localhost:3000/auth/callback?provider=google&next=/" },
    });
  });

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

  it("explains when Google access is not authorized", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("error=google_access"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<LoginPage />));

    expect(container?.textContent).toContain("Tu cuenta no tiene una invitación activa");
  });
});
