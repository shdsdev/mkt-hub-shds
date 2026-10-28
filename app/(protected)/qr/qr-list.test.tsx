// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), query: "", remove: vi.fn(), restore: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }), usePathname: () => "/qr", useSearchParams: () => new URLSearchParams(mocks.query) }));
vi.mock("./actions", () => ({ deleteQrCodeAction: mocks.remove, restoreQrCodeAction: mocks.restore, archiveQrCodeAction: vi.fn(), updateDynamicQrUtmAction: vi.fn(), updateQrMetadataAction: vi.fn(), updateQrNameAction: vi.fn() }));
vi.mock("../links/actions", () => ({ updateDestinationAction: vi.fn() }));
vi.mock("./create-qr-modal", () => ({ CreateQrModal: () => <button>Crear QR</button> }));
vi.mock("border-beam", () => ({ BorderBeam: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/hover-morph-icon", () => ({ HoverMorphIcon: () => <span /> }));
vi.mock("./placement-image-upload", () => ({ PlacementImageUpload: () => null }));

import { QrList, type QrListRow } from "./qr-list";

const row: QrListRow = { id: "qr-1", name: "Product QR", mode: "dynamic", status: "active", createdAt: new Date("2026-01-01"), deletedAt: null, logoUrl: null, scanCount: 4, linkId: "link-1", folderId: null, campaignId: null };
let host: HTMLDivElement;
let root: Root;
function button(label: string) {
  const found = Array.from(document.querySelectorAll("button")).find((element) => element.getAttribute("aria-label") === label || element.textContent?.trim() === label);
  if (!found) throw new Error(`Missing button: ${label}. Available: ${Array.from(document.querySelectorAll("button")).map((element) => element.textContent?.trim()).join(" | ")}`);
  return found;
}
async function click(label: string) { await act(async () => { button(label).click(); }); }
async function render(overrides: Partial<React.ComponentProps<typeof QrList>> = {}) {
  await act(async () => root.render(<QrList rows={[row]} organizationId="org-1" folders={[{ id: "f1", name: "Print" } as never]} campaigns={[]} navigationCampaigns={[{ id: "c1", name: "Launch" } as never]} navigationCounts={{ total: 25, trash: 1, folders: { f1: 4 }, campaigns: { c1: 2 } }} utmPresets={[]} templates={[]} total={25} page={2} pageSize={20} filter={{}} {...overrides} />));
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query = "page=2&q=product&campaign=c1";
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, ResizeObserver: class { observe() {} unobserve() {} disconnect() {} } });
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

describe("QR organization", () => {
  it("shows the selected group title and accessible current item", async () => {
    await render({ filter: { folderId: "f1" }, total: 4 });
    expect(host.querySelector("h2 > span")?.textContent).toBe("Print");
    expect(button("Print (4)").getAttribute("aria-current")).toBe("page");
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    expect(host.querySelector('[aria-label="Filtrar por carpeta"]')).toBeNull();
  });
  it("retains empty groups and supports desktop collapse", async () => {
    await render({ navigationCounts: { total: 0, trash: 0, folders: {}, campaigns: {} } });
    expect(button("Print (0)")).toBeDefined();
    expect(button("Launch (0)")).toBeDefined();
    const nav = button("Print (0)").closest("nav");
    await click("Contraer organización");
    expect(nav?.parentElement?.hidden).toBe(true);
    expect(button("Expandir organización").getAttribute("aria-expanded")).toBe("false");
    await click("Expandir organización");
    expect(nav?.parentElement?.hidden).toBe(false);
  });
  it("searches within the current group and preserves other filters", async () => {
    vi.useFakeTimers();
    mocks.query = "folder=f1&status=archived&page=2";
    await render({ filter: { folderId: "f1", status: "archived" } });
    const input = host.querySelector('input[aria-label="Buscar en Print"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "poster");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(mocks.push).toHaveBeenLastCalledWith("/qr?folder=f1&status=archived&q=poster");
  });
  it("switches groups exclusively, preserves search and resets pagination", async () => {
    await render({ filter: { search: "product", campaignId: "c1" } });
    await click("Print (4)");
    expect(mocks.push).toHaveBeenLastCalledWith("/qr?q=product&folder=f1");
    await click("Papelera (1)");
    expect(mocks.push).toHaveBeenLastCalledWith("/qr?q=product&trash=1");
    await click("Todos los QR (25)");
    expect(mocks.push).toHaveBeenLastCalledWith("/qr?q=product");
  });
  it("preserves trash and scoped search when paginating", async () => {
    mocks.query = "trash=1&q=product&page=1";
    await render({ page: 1, filter: { trash: true, search: "product" } });
    const next = document.querySelector('a[aria-label="Ir a la página siguiente"]') as HTMLAnchorElement;
    expect(next).not.toBeNull();
    await act(async () => next.click());
    expect(mocks.push).toHaveBeenLastCalledWith("/qr?trash=1&q=product&page=2");
  });
  it("opens a labelled mobile organizer and returns focus on Escape", async () => {
    await render();
    button("Cambiar grupo: Conjuntos").focus();
    await click("Cambiar grupo: Conjuntos");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Organizar");
    expect(document.querySelector('[role="dialog"]')?.getAttribute("data-side")).toBe("bottom");
    expect(document.querySelector('[role="dialog"]')?.contains(document.activeElement)).toBe(true);
    await act(async () => { document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(document.activeElement).toBe(button("Cambiar grupo: Conjuntos"));
  });
  it("shows the selected group in the mobile header and closes after selection", async () => {
    await render({ filter: { folderId: "f1" }, total: 4 });
    const trigger = button("Cambiar grupo: Conjuntos");
    expect(trigger.classList.contains("border-border")).toBe(true);
    expect(trigger.classList.contains("bg-secondary")).toBe(true);
    expect(trigger.closest("h2")).toBeNull();
    await click("Cambiar grupo: Conjuntos");
    const dialog = document.querySelector('[role="dialog"]')!;
    const trash = dialog.querySelector('button[aria-label="Papelera (1)"]') as HTMLButtonElement;
    await act(async () => trash.click());
    expect(mocks.push).toHaveBeenLastCalledWith("/qr?trash=1");
    expect(dialog.getAttribute("data-open")).toBeNull();
  });
});

describe("QR lifecycle", () => {
  it("confirms dynamic deletion and shows pending, error, retry and success", async () => {
    let resolve!: (state: { error?: string; success?: boolean }) => void;
    mocks.remove.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await render();
    await click("Eliminar Product QR");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("impresos dejarán de funcionar");
    await click("Mover a la papelera");
    expect(button("Procesando...").disabled).toBe(true);
    expect(button("Cancelar").disabled).toBe(true);
    expect(mocks.remove.mock.calls[0][1].get("id")).toBe("qr-1");
    await act(async () => resolve({ error: "Intenta de nuevo" }));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Intenta de nuevo");
    mocks.remove.mockResolvedValue({ success: true });
    await click("Mover a la papelera");
    expect(document.querySelector('[role="dialog"] [role="status"]')?.textContent).toContain("movido a la papelera");
    expect(mocks.refresh).toHaveBeenCalled();
  });
  it("explains static printed copies and offers deletion in grid view", async () => {
    await render({ rows: [{ ...row, mode: "static" }] });
    await click("Cuadrícula");
    await click("Eliminar Product QR");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("no se pueden desactivar");
  });
  it("only offers restore for trashed rows, including in grid view", async () => {
    await render({ rows: [{ ...row, deletedAt: new Date() }], filter: { trash: true } });
    expect(host.textContent).not.toContain("Crear QR");
    expect(host.querySelector('[aria-label="Descargar"]')).toBeNull();
    expect(host.textContent).not.toContain("Archivar");
    expect(host.textContent).not.toContain("Editar");
    expect(host.querySelector('img[src*="download"]')).toBeNull();
    await click("Cuadrícula");
    await click("Restaurar Product QR");
    mocks.restore.mockRejectedValue(new Error("network"));
    await click("Restaurar QR");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Vuelve a intentarlo");
    mocks.restore.mockResolvedValue({ success: true });
    await click("Restaurar QR");
    expect(document.querySelector('[role="dialog"] [role="status"]')?.textContent).toContain("restaurado");
  });
});
