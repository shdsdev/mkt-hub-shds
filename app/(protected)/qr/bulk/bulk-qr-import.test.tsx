import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const push = vi.fn();
  return {
    useRef: vi.fn(),
    useState: vi.fn(),
    useTransition: vi.fn(),
    useQrPreview: vi.fn(),
    createBulkWebsiteQrCodesAction: vi.fn(),
    push,
    useRouter: vi.fn(() => ({ push })),
  };
});

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useRef: mocks.useRef, useState: mocks.useState, useTransition: mocks.useTransition };
});

vi.mock("../group-select", () => ({ GroupSelect: () => null }));
vi.mock("../qr-design-fields", () => ({ QrDesignFields: () => null }));
vi.mock("../use-qr-preview", () => ({ useQrPreview: mocks.useQrPreview }));
vi.mock("../actions", () => ({ createBulkWebsiteQrCodesAction: mocks.createBulkWebsiteQrCodesAction }));
vi.mock("next/navigation", () => ({ useRouter: mocks.useRouter }));
vi.mock("@base-ui/react/dialog", () => ({
  Dialog: {
    Root: ({ open, children }: { open?: boolean; children: ReactNode }) => (open ? children : null),
    Portal: ({ children }: { children: ReactNode }) => <>{children}</>,
    Backdrop: () => null,
    Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Title: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    Trigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  },
}));
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

function renderReview(rows: { rowNumber: number; url: string; title: string }[], summary: import("../actions").BulkQrImportSummary | null = null) {
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
    .mockReturnValueOnce([summary, setState]);
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
    mocks.useRouter.mockImplementation(() => ({ push: mocks.push }));
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

  it("shows the success dialog and navigates to /qr on Aceptar", () => {
    mocks.useQrPreview.mockReturnValue(undefined);
    const rows = [
      { rowNumber: 1, url: "https://first.example/path", title: "First" },
      { rowNumber: 2, url: "https://second.example/path", title: "Second" },
    ];

    const tree = renderReview(rows, {
      requested: 2,
      created: 2,
      failed: 0,
      results: [
        { rowNumber: 1, title: "First", status: "created", qrCodeId: "qr-1" },
        { rowNumber: 2, title: "Second", status: "created", qrCodeId: "qr-2" },
      ],
    });

    expect(getText(tree)).toContain("Códigos QR creados con éxito");
    expect(getText(tree)).toContain("Se crearon 2 códigos QR.");
    const acceptButton = findButton(tree, "Aceptar");
    expect(acceptButton?.props.onClick).toBeTypeOf("function");
    acceptButton?.props.onClick?.();
    expect(mocks.push).toHaveBeenCalledWith("/qr");
  });

  it("does not show the dialog on partial success and keeps the failed rows", () => {
    mocks.useQrPreview.mockReturnValue(undefined);
    const rows = [
      { rowNumber: 1, url: "https://first.example/path", title: "First" },
      { rowNumber: 2, url: "https://second.example/path", title: "Second" },
    ];

    const tree = renderReview(rows, {
      requested: 2,
      created: 1,
      failed: 1,
      results: [
        { rowNumber: 1, title: "First", status: "created", qrCodeId: "qr-1" },
        { rowNumber: 2, title: "Second", status: "failed", error: "Dominio bloqueado" },
      ],
    });

    expect(getText(tree)).not.toContain("Códigos QR creados con éxito");
    expect(getText(tree)).toContain("Fila 2: Dominio bloqueado");
  });

  it("does not show the dialog on a batch error and keeps the error alert", () => {
    mocks.useQrPreview.mockReturnValue(undefined);
    const rows = [
      { rowNumber: 1, url: "https://first.example/path", title: "First" },
      { rowNumber: 2, url: "https://second.example/path", title: "Second" },
    ];

    const tree = renderReview(rows, {
      requested: 0,
      created: 0,
      failed: 0,
      results: [],
      error: "Rate limit excedido",
    });

    expect(getText(tree)).not.toContain("Códigos QR creados con éxito");
    expect(getText(tree)).toContain("Rate limit excedido");
  });
});
