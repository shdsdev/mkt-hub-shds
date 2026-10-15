import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  createClient: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));

import { requestPasswordRecovery } from "./recovery-actions";

function emailFormData(email = "target@example.com") {
  const formData = new FormData();
  formData.set("email", email);
  return formData;
}

describe("requestPasswordRecovery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.headers.mockResolvedValue(new Headers({ host: "shmx.men", "x-forwarded-proto": "https" }));
    mocks.createClient.mockResolvedValue({
      auth: { resetPasswordForEmail: mocks.resetPasswordForEmail },
    });
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it("sends a password setup link to a valid email", async () => {
    await expect(requestPasswordRecovery({}, emailFormData())).resolves.toEqual({
      success: "Si el correo está registrado, recibirás un enlace para crear tu contraseña.",
    });

    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("target@example.com", {
      redirectTo: "https://shmx.men/auth/callback?next=%2Fpassword-setup",
    });
  });

  it("returns the same generic response when Supabase rejects the request", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: { message: "rate limited" } });

    await expect(requestPasswordRecovery({}, emailFormData())).resolves.toEqual({
      success: "Si el correo está registrado, recibirás un enlace para crear tu contraseña.",
    });
  });

  it("rejects malformed email without calling Supabase", async () => {
    await expect(requestPasswordRecovery({}, emailFormData("not-an-email"))).resolves.toEqual({
      error: "Ingresa un correo electrónico válido.",
    });

    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
