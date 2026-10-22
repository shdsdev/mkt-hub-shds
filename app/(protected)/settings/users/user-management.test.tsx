// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  changeUserRoleAction: vi.fn(),
  disableUserAction: vi.fn(),
  inviteUserAction: vi.fn(),
  reactivateUserAction: vi.fn(),
  sendPasswordSetupLinkAction: vi.fn(),
  deleteUserAction: vi.fn(),
}));

import { UserManagement } from "./user-management";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("UserManagement", () => {
  it("renders a password setup link action for each managed user", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() =>
      root?.render(
        <UserManagement
          users={[
            {
              id: "7a29aa2a-4e37-4b15-97a0-1aa6fef2f36d",
              organizationId: "org-1",
              role: "MARKETING_USER",
              status: "active",
              email: "target@example.com",
              createdAt: new Date("2026-01-01T00:00:00Z"),
            },
          ]}
        />,
      ),
    );

    expect(container?.textContent).toContain("Acciones");
    expect(container?.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(container?.textContent).not.toContain("Último acceso");
    expect(container?.textContent).not.toContain("Dos pasos");
    expect(container?.textContent).not.toContain("Guardar");
    expect(container?.querySelector("table")?.className).toContain("table-fixed");
    expect(container?.querySelector("table")?.className).not.toContain("min-w-[900px]");
  });

  it("opens a non-blocking deletion confirmation instead of calling window.confirm", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() =>
      root?.render(
        <UserManagement
          users={[
            {
              id: "7a29aa2a-4e37-4b15-97a0-1aa6fef2f36d",
              organizationId: "org-1",
              role: "MARKETING_USER",
              status: "active",
              email: "target@example.com",
              createdAt: new Date("2026-01-01T00:00:00Z"),
            },
          ]}
        />,
      ),
    );

    const menuTrigger = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Acciones"),
    );
    expect(menuTrigger).toBeDefined();
    act(() => menuTrigger?.click());

    const actionButton = Array.from(document.body.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Eliminar definitivamente"),
    );
    expect(actionButton).toBeDefined();

    act(() => actionButton?.click());

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(container.textContent).toContain("Confirmar eliminación");
    confirmSpy.mockRestore();
  });
});
