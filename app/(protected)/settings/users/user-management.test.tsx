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
  });
});
