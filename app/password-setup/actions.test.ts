import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mocks.getUser, updateUser: mocks.updateUser },
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { setInvitationPassword } from "./actions";

function passwordFormData(password: string, confirmPassword = password) {
  const formData = new FormData();
  formData.set("password", password);
  formData.set("confirmPassword", confirmPassword);
  return formData;
}

describe("setInvitationPassword", () => {
  it("does not update a password without an authenticated invitation session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await expect(
      setInvitationPassword({}, passwordFormData("correct horse battery staple")),
    ).resolves.toEqual({ error: "La invitación no es válida o expiró." });

    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 12 characters without calling the provider", async () => {
    await expect(setInvitationPassword({}, passwordFormData("short"))).resolves.toEqual({
      error: "La contraseña debe tener al menos 12 caracteres y coincidir.",
    });

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects non-matching confirmation without calling the provider", async () => {
    await expect(
      setInvitationPassword({}, passwordFormData("correct horse battery staple", "different-one")),
    ).resolves.toEqual({
      error: "La contraseña debe tener al menos 12 caracteres y coincidir.",
    });

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password and redirects for an authenticated session", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "target@example.com" } },
    });
    mocks.updateUser.mockResolvedValue({ error: null });

    await setInvitationPassword({}, passwordFormData("correct horse battery staple"));

    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "correct horse battery staple" });
    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });

  it("returns a retry-safe failure when the password update fails", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "target@example.com" } },
    });
    mocks.updateUser.mockResolvedValue({ error: { message: "provider rejected" } });

    await expect(
      setInvitationPassword({}, passwordFormData("correct horse battery staple")),
    ).resolves.toEqual({ error: "No se pudo actualizar la contraseña. Inténtalo de nuevo." });

    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});