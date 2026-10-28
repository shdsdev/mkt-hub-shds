// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccessCodeCopyButton } from "./access-code-copy-button";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));

function render(code = "AB12CD34") {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const onSubmit = vi.fn((event) => event.preventDefault());
  act(() => root.render(<form onSubmit={onSubmit}><AccessCodeCopyButton code={code} /></form>));
  return { button: container.querySelector("button")!, onSubmit };
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

it("copies only on activation, reports success, and never submits the form", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const { button, onSubmit } = render();
  expect(writeText).not.toHaveBeenCalled();
  expect(button.type).toBe("button");
  expect(button.getAttribute("aria-label")).toBe("Copiar folio de acceso AB12CD34");
  expect(container.querySelector(".text-4xl.leading-none")?.textContent).toBe("AB12CD34");
  await act(async () => button.click());
  expect(writeText).toHaveBeenCalledWith("AB12CD34");
  expect(container.querySelector('[role="status"]')?.textContent).toBe("Copiado");
  expect(onSubmit).not.toHaveBeenCalled();
  await act(async () => button.click());
  expect(writeText).toHaveBeenCalledTimes(2);
});

it("reports clipboard rejection and allows retry", async () => {
  const writeText = vi.fn().mockRejectedValueOnce(new Error("Denied")).mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const { button } = render();
  await act(async () => button.click());
  expect(container.querySelector('[role="status"]')?.textContent).toBe("No se pudo copiar");
  expect(button.disabled).toBe(false);
  await act(async () => button.click());
  expect(container.querySelector('[role="status"]')?.textContent).toBe("Copiado");
});

it("reports unavailable clipboard without claiming success", async () => {
  vi.stubGlobal("navigator", {});
  const { button } = render();
  await act(async () => button.click());
  expect(container.querySelector('[role="status"]')?.textContent).toBe("No se pudo copiar");
});

it("prevents overlapping copies while the clipboard request is pending", async () => {
  let resolve!: () => void;
  const writeText = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const { button } = render();
  act(() => button.click());
  expect(button.disabled).toBe(true);
  act(() => button.click());
  expect(writeText).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
  expect(button.disabled).toBe(false);
});
