import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useState: vi.fn(),
  push: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useState: mocks.useState };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("./website-qr-form", () => ({ WebsiteQrForm: () => null }));
vi.mock("./static-qr-form", () => ({ StaticQrForm: () => null }));
vi.mock("./qr-success-panel", () => ({ QrSuccessPanel: () => null }));

import { CreateQrModal } from "./create-qr-modal";

function getText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getText).join("");
  return isValidElement<{ children?: ReactNode }>(node) ? getText(node.props.children) : "";
}

function findButton(tree: ReactNode, label: string): ReactElement<{ onClick?: () => void }> | undefined {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const match = findButton(child, label);
      if (match) return match;
    }
    return undefined;
  }
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(tree)) return undefined;
  if (tree.type === "button" && getText(tree).includes(label)) return tree;
  return findButton(tree.props.children, label);
}

describe("CreateQrModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("offers individual and batch creation before choosing a QR type", () => {
    const setScreen = vi.fn();
    mocks.useState
      .mockReturnValueOnce([true, vi.fn()])
      .mockReturnValueOnce(["choice", setScreen])
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([undefined, vi.fn()]);

    const tree = CreateQrModal({
      organizationId: "organization-1",
      folders: [],
      campaigns: [],
      utmPresets: [],
      templates: [],
    });

    expect(getText(tree)).toContain("Crear individual");
    expect(getText(tree)).toContain("Crear por lote");
    findButton(tree, "Crear individual")?.props.onClick?.();
    expect(setScreen).toHaveBeenCalledWith("type");
  });

  it("navigates to bulk creation when the batch choice is selected", () => {
    mocks.useState
      .mockReturnValueOnce([true, vi.fn()])
      .mockReturnValueOnce(["choice", vi.fn()])
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([undefined, vi.fn()]);

    const tree = CreateQrModal({
      organizationId: "organization-1",
      folders: [],
      campaigns: [],
      utmPresets: [],
      templates: [],
    });

    findButton(tree, "Crear por lote")?.props.onClick?.();
    expect(mocks.push).toHaveBeenCalledWith("/qr/bulk");
  });
});
