import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useRef: vi.fn(),
  useState: vi.fn(),
  useTransition: vi.fn(),
  useQrPreview: vi.fn(),
  createBulkWebsiteQrCodesAction: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useRef: mocks.useRef, useState: mocks.useState, useTransition: mocks.useTransition };
});

vi.mock("../group-select", () => ({ GroupSelect: () => null }));
vi.mock("../qr-design-fields", () => ({ QrDesignFields: () => null }));
vi.mock("../use-qr-preview", () => ({ useQrPreview: mocks.useQrPreview }));
vi.mock("../actions", () => ({ createBulkWebsiteQrCodesAction: mocks.createBulkWebsiteQrCodesAction }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children }: { children: ReactNode }) => <button>{children}</button> }));
vi.mock("lucide-react", () => ({ Download: () => null, Upload: () => null }));

import { Button } from "@/components/ui/button";
import { BulkQrImport } from "./bulk-qr-import";

const design = {
  backgroundColor: "#112233",
  foregroundColor: "#fefefe",
  errorCorrectionLevel: "H" as const,
  logoUrl: "https://cdn.example/logo.svg",
  dotsType: "rounded" as const,
  cornersSquareType: "extra-rounded" as const,
  cornersDotType: "dot" as const,
};

function findElements(node: ReactNode, type: unknown): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, type));
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [
    ...(node.type === type ? [node] : []),
    ...findElements(node.props.children, type),
  ];
}

function findButton(
  tree: ReactNode,
  label: string,
): ReactElement<{ children?: ReactNode; onClick?: () => void }> | undefined {
  return findElements(tree, Button).find((element) => getText(element) === label) as
    | ReactElement<{ children?: ReactNode; onClick?: () => void }>
    | undefined;
}

function getText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getText).join("");
  return isValidElement<{ children?: ReactNode }>(node) ? getText(node.props.children) : "";
}

function renderReview(rows: { rowNumber: number; url: string; title: string }[]) {
  const setState = vi.fn();
  mocks.useRef.mockReturnValue({ current: null });
  mocks.useState
    .mockReturnValueOnce(["review", setState])
    .mockReturnValueOnce([{ rows, invalidRows: [] }, setState])
    .mockReturnValueOnce([undefined, setState])
    .mockReturnValueOnce([{ folderId: "folder-1" }, setState])
    .mockReturnValueOnce([design, setState])
    .mockReturnValueOnce([false, setState])
    .mockReturnValueOnce(["", setState])
    .mockReturnValueOnce([null, setState]);
  mocks.useTransition.mockReturnValue([
    false,
    (callback: () => void | Promise<void>) => {
      void callback();
    },
  ]);

  return BulkQrImport({
    organizationId: "organization-1",
    folders: [],
    campaigns: [],
    templates: [],
  });
}

describe("BulkQrImport", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders one shared QR preview for the first valid CSV URL", () => {
    mocks.useQrPreview.mockReturnValue("blob:bulk-preview");

    const tree = renderReview([
      { rowNumber: 1, url: "https://first.example/path", title: "First" },
      { rowNumber: 2, url: "https://second.example/path", title: "Second" },
    ]);

    expect(mocks.useQrPreview).toHaveBeenCalledWith({
      payload: "https://first.example/path",
      ...design,
    });
    expect(findElements(tree, "img")).toEqual([
      expect.objectContaining({
        props: expect.objectContaining({
          alt: "Vista previa del código QR del lote",
          src: "blob:bulk-preview",
        }),
      }),
    ]);
  });

  it("renders the empty state when no valid URL or preview is available", () => {
    mocks.useQrPreview.mockReturnValue(undefined);

    const tree = renderReview([]);

    expect(mocks.useQrPreview).toHaveBeenCalledWith({ payload: undefined, ...design });
    expect(findElements(tree, "img")).toEqual([]);
    expect(getText(tree)).toContain("No hay una vista previa del código QR disponible.");
  });

  it("creates bulk QR codes with the valid rows, folder and design", () => {
    mocks.useQrPreview.mockReturnValue(undefined);
    const rows = [
      { rowNumber: 1, url: "https://first.example/path", title: "First" },
      { rowNumber: 2, url: "https://second.example/path", title: "Second" },
    ];

    const tree = renderReview(rows);
    const createButton = findButton(tree, "Crear códigos QR");

    expect(createButton?.props.onClick).toBeTypeOf("function");
    createButton?.props.onClick?.();

    expect(mocks.createBulkWebsiteQrCodesAction).toHaveBeenCalledWith({
      rows,
      folderId: "folder-1",
      design,
      saveAsTemplate: false,
      templateName: "",
    });
  });
});
