// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

vi.mock("@base-ui/react/dialog", () => ({
  Dialog: {
    Root: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Backdrop: () => null,
    Popup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Title: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

import { CompanionAddedDialog } from "./companion-added-dialog";

describe("CompanionAddedDialog", () => {
  it("explains that confirmation waits for titular approval", () => {
    const { container } = renderDialog({ fullName: "Grace Hopper", backupCode: "GRACE678", emailStatus: "pending_approval" });

    expect(container.textContent).toContain("La confirmación se enviará cuando se apruebe al titular.");
    expect(container.querySelector("[role='status']")?.className).toContain("border-amber-500");
  });

  it("confirms when the companion email was sent", () => {
    const { container } = renderDialog({ fullName: "Grace Hopper", backupCode: "GRACE678", emailStatus: "sent" });

    expect(container.textContent).toContain("confirmación enviada por correo.");
  });

  it("reports when an approved companion email failed", () => {
    const { container } = renderDialog({ fullName: "Grace Hopper", backupCode: "GRACE678", emailStatus: "failed" });

    expect(container.textContent).toContain("no se pudo enviar la confirmación");
  });
});

function renderDialog(companion: { fullName: string; backupCode: string; emailStatus: "sent" | "pending_approval" | "failed" }) {
  const container = document.createElement("div");
  const root = document.body.appendChild(container);
  const reactRoot = createRoot(root);
  act(() => {
    reactRoot.render(<CompanionAddedDialog open onOpenChange={vi.fn()} companion={companion} />);
  });
  return { container: root, unmount: () => reactRoot.unmount() };
}
