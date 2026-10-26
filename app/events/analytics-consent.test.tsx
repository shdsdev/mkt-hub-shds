// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({
  default: ({ children, ...props }: { children?: string; [key: string]: unknown }) => (
    <script {...props}>{children}</script>
  ),
}));

import { AnalyticsConsent } from "./analytics-consent";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  localStorage.clear();
  root = undefined;
  container = undefined;
  vi.restoreAllMocks();
});

function renderConsent() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<AnalyticsConsent gaId="G-TEST123" />));
}

describe("AnalyticsConsent", () => {
  it("does not load GA4 from local storage until the server confirms consent", async () => {
    localStorage.setItem("marketing-hub-analytics-consent", "granted");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: undefined }))));

    renderConsent();
    await act(async () => {});

    expect(container?.querySelector('script[src*="googletagmanager"]')).toBeNull();
    expect(container?.textContent).toContain("Ayúdanos a mejorar este sitio");
  });

  it("asks for analytics consent before loading Google Analytics", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: undefined }))));
    renderConsent();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(container?.textContent).toContain("¿Nos permites recopilar información sobre cómo usas el sitio para mejorar tu experiencia?");
    expect(container?.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });

  it("loads GA4 only after server-confirmed analytics consent is accepted", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ state: undefined })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    renderConsent();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    const acceptButton = Array.from(container?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("Sí, acepto"),
    );
    await act(async () => acceptButton?.click());
    await act(async () => {});

    expect(container?.querySelector('script[src*="id=G-TEST123"]')).not.toBeNull();
    expect(container?.textContent).not.toContain("Sí, acepto");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/analytics/consent", expect.objectContaining({ method: "POST" }));
  });

  it("does not load GA4 after analytics consent is rejected", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ state: undefined })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    renderConsent();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    const rejectButton = Array.from(container?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("No, gracias"),
    );
    await act(async () => rejectButton?.click());

    expect(container?.querySelector('script[src*="googletagmanager"]')).toBeNull();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/analytics/consent", expect.objectContaining({ method: "DELETE" }));
  });

  it("shows a recoverable error when consent cannot be saved", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ state: undefined })))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    renderConsent();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    const acceptButton = Array.from(container?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("Sí, acepto"),
    );
    await act(async () => acceptButton?.click());
    await act(async () => {});

    expect(container?.textContent).toContain("No pudimos guardar tu elección. Inténtalo de nuevo.");
    expect(container?.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });
});
